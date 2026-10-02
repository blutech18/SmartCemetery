import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { smartSearch } from "@/lib/search";
import { isAuthorized, requireAuth, requireRole } from "@/lib/authz";
import {
  validateBody,
  validationErrorResponse,
  checkDuplicateGrave,
} from "@/lib/validation";
import {
  encryptGraveDetail,
  decryptGraveDetail,
  EncryptionKeyError,
  DecryptionError,
} from "@/lib/encryption";
import { getClientIp, writeAuditLog } from "@/lib/audit";
import { stripSensitiveDetail } from "@/lib/plot-query";
import { schemaOutOfDateResponse } from "@/lib/db-errors";
import { MAX_TIERS } from "@/lib/cemetery-layout";
import { boundedRateLimit, consumeRateLimit } from "@/lib/rate-limit";

// Uniform encryption-error response (Req 3.3, 3.4). Shape matches the platform
// error envelope: { error: { type, message } }.
function encryptionErrorResponse(message) {
  return NextResponse.json(
    { error: { type: "encryption", message } },
    { status: 500 }
  );
}

/**
 * Prepare a grave's details for the response.
 * - Authorized callers (role permitted for "graves") receive decrypted plaintext (Req 3.2).
 * - All other callers receive the record with sensitive fields stripped, so
 *   encrypted values never leak through the public search path.
 * @throws {DecryptionError|EncryptionKeyError} on authorized reads when a stored
 *   value cannot be decrypted / the key is invalid (Req 3.3, 3.4).
 */
function exposeGraveDetails(grave, authorized) {
  if (!grave || !grave.details) return grave;
  const details = authorized
    ? decryptGraveDetail(grave.details)
    : stripSensitiveDetail(grave.details);
  return { ...grave, details };
}

// Validation schema for grave creation (Req 15).
const CREATE_GRAVE_SCHEMA = {
  deceasedName: { required: true, type: "string", trim: true, max: 200 },
  plotId: { required: true, type: "integer" },
  tier: { type: "integer", min: 1, max: MAX_TIERS },
};

// Optional sensitive detail fields accepted on creation. Bounds mirror the
// PATCH route (graves/[id]) so oversized values cannot bypass validation on the
// create path.
const CREATE_GRAVE_DETAILS_SCHEMA = {
  burialDate: { type: "string", trim: true, max: 40 },
  birthDate: { type: "string", trim: true, max: 40 },
  deathDate: { type: "string", trim: true, max: 40 },
  causeOfDeath: { type: "string", trim: true, max: 5000 },
  contactPerson: { type: "string", trim: true, max: 500 },
  contactPhone: { type: "string", trim: true, max: 100 },
  notes: { type: "string", trim: true, max: 10000 },
};

// GET /api/graves — List graves or search
export async function GET(request) {
  try {
    // Public path: never reject. We only use the result to decide whether
    // sensitive detail fields may be exposed as decrypted plaintext. Sensitive
    // access is the `verify` permission (Admin/Staff), consistent with
    // /api/plots and the platform's field-level policy.
    const auth = await requireAuth(request);
    const authorized = auth.ok && isAuthorized(auth.user.role, "verify");

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const status = searchParams.get("status");
    const verificationStatus = searchParams.get("verificationStatus");
    const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const parsedLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
    const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 50)
      : 20;

    if (query && query.length > 100) {
      return NextResponse.json({ error: "Search query is too long" }, { status: 400 });
    }

    // Smart Search mode
    if (query) {
      const baseLimit = boundedRateLimit("SEARCH_RATE_LIMIT_MAX", 60, 5, 1_000);
      const windowSeconds = boundedRateLimit("SEARCH_RATE_LIMIT_WINDOW_SECONDS", 60, 10, 3_600);
      let throttle;
      try {
        throttle = await consumeRateLimit({
          scope: "grave-search",
          identifier: getClientIp(request) || "unresolved",
          limit: authorized ? baseLimit * 4 : baseLimit,
          windowMs: windowSeconds * 1000,
        });
      } catch {
        return NextResponse.json(
          { error: { type: "rate_limit_unavailable", message: "Search is temporarily unavailable" } },
          { status: 503 }
        );
      }
      if (!throttle.allowed) {
        return NextResponse.json(
          { error: { type: "rate_limit", message: "Too many searches. Please try again shortly." } },
          { status: 429, headers: { "Retry-After": String(throttle.retryAfterSeconds) } }
        );
      }

      const results = await smartSearch(prisma, query);
      return NextResponse.json({
        exact: results.exact.map((g) => exposeGraveDetails(g, authorized)),
        suggestions: results.suggestions.map((g) => exposeGraveDetails(g, authorized)),
        nearby: (results.nearby || []).map((g) => exposeGraveDetails(g, authorized)),
        matchType: results.matchType || "none",
      });
    }

    // Bulk listing is restricted to cemetery personnel. Public callers use the
    // bounded search mode above rather than enumerating the full registry.
    const listAuth = await requireRole(request, "verify");
    if (!listAuth.ok) return listAuth.response;

    // List mode with pagination
    const where = {};
    if (status) where.status = status;
    if (verificationStatus) where.verificationStatus = verificationStatus;

    const [graves, total] = await Promise.all([
      prisma.grave.findMany({
        where,
        include: {
          plot: {
            include: {
              locationDetail: {
                include: { location: true },
              },
              photos: { select: { tier: true, url: true } },
            },
          },
          details: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.grave.count({ where }),
    ]);

    return NextResponse.json({
      graves: graves.map((g) => exposeGraveDetails(g, authorized)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof EncryptionKeyError) {
      return encryptionErrorResponse("Encryption key is unavailable or invalid");
    }
    const behind = schemaOutOfDateResponse(error, "GET /api/graves");
    if (behind) return behind;
    console.error("GET /api/graves error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/graves — Create new grave record
export async function POST(request) {
  try {
    // Authorization before any mutation (Req 2.4).
    const authz = await requireRole(request, "graves");
    if (!authz.ok) return authz.response;
    const { user } = authz;

    const body = await request.json();

    // Uniform validation (Req 15.1, 15.4).
    const validation = validateBody(body, CREATE_GRAVE_SCHEMA);
    if (!validation.valid) {
      return validationErrorResponse(validation.errors);
    }
    const { deceasedName, plotId, tier = 1 } = validation.value;

    // Validate optional detail fields before they reach encryption/Prisma.
    const detailValidation = validateBody(body, CREATE_GRAVE_DETAILS_SCHEMA);
    if (!detailValidation.valid) {
      return validationErrorResponse(detailValidation.errors);
    }
    const { burialDate, birthDate, deathDate, causeOfDeath, contactPerson, contactPhone, notes } =
      detailValidation.value;
    const { confirm } = body;

    for (const [field, value] of Object.entries({ burialDate, birthDate, deathDate })) {
      if (value !== undefined && value !== "" && !Number.isFinite(new Date(value).getTime())) {
        return validationErrorResponse([
          { field, code: "type", message: `${field} must be a valid date` },
        ]);
      }
    }

    // Duplicate gating (Req 4.2–4.5). Run AFTER authz + validation but BEFORE
    // creating the grave. Wrapped in its own try/catch so a detection failure
    // can never fall through to creation (Req 4.5).
    let duplicateResult;
    try {
      duplicateResult = await checkDuplicateGrave(prisma, deceasedName, burialDate);
    } catch (err) {
      // Detection failed — abort creation and surface a distinct internal error
      // instead of silently creating a possibly-duplicate record (Req 4.5).
      console.error("POST /api/graves duplicate detection failed:", err);
      return NextResponse.json(
        {
          error: {
            type: "internal",
            message: "Duplicate detection could not be completed",
          },
        },
        { status: 500 }
      );
    }

    // Duplicates exist and the caller has not explicitly confirmed — block the
    // creation and return the matching records so the client can prompt for
    // confirmation (Req 4.2). Confirmed requests (confirm === true) fall through
    // and create despite duplicates (Req 4.3); no duplicates likewise proceeds
    // without requiring confirmation (Req 4.4).
    if (duplicateResult.hasDuplicate && confirm !== true) {
      return NextResponse.json(
        {
          error: {
            type: "conflict",
            message:
              "A similar grave record already exists. Resubmit with confirm=true to create anyway.",
          },
          duplicates: duplicateResult.duplicates,
        },
        { status: 409 }
      );
    }

    // Encrypt sensitive detail fields BEFORE persisting so plaintext is never
    // written. Empty/absent sensitive values become null.
    const hasDetails = causeOfDeath || contactPerson || contactPhone || notes;
    let encryptedDetail = null;
    if (hasDetails) {
      try {
        encryptedDetail = encryptGraveDetail({
          causeOfDeath,
          contactPerson,
          contactPhone,
          notes,
        });
      } catch (err) {
        if (err instanceof EncryptionKeyError) {
          return encryptionErrorResponse(
            "Encryption key is unavailable or invalid"
          );
        }
        throw err;
      }
    }

    // Claim the plot and create its grave in the same transaction. For
    // multi-tier plots (e.g. 4-tier crypt stacks) the plot may already be
    // "occupied" by another tier's grave — only the specific (plotId, tier)
    // pair must be free. The DB unique constraint on (plot_id, tier) is the
    // final invariant.
    const transactionResult = await prisma.$transaction(async (tx) => {
      const existingPlot = await tx.plot.findUnique({
        where: { id: plotId },
        select: { id: true, status: true, totalTiers: true },
      });
      if (!existingPlot) {
        return { claimError: { status: 404, message: "Plot not found" } };
      }

      if (existingPlot.status === "maintenance") {
        return {
          claimError: {
            status: 409,
            message: "This plot is under maintenance. Set it back to Occupied or Available before adding a record.",
          },
        };
      }

      // The tier must exist in this plot (an ordinary lot has a single tier).
      if (Number.isFinite(existingPlot.totalTiers) && tier > existingPlot.totalTiers) {
        return {
          claimError: {
            status: 400,
            message: `Tier ${tier} does not exist: this plot has ${existingPlot.totalTiers} tier(s)`,
          },
        };
      }

      // Check if this specific tier is already taken
      const existingGrave = await tx.grave.findFirst({
        where: { plotId, tier },
        select: { id: true },
      });
      if (existingGrave) {
        return {
          claimError: { status: 409, message: `Tier ${tier} is already occupied for this plot` },
        };
      }

      // Only transition plot status if it's still available
      if (existingPlot.status === "available") {
        await tx.plot.update({
          where: { id: plotId },
          data: { status: "occupied" },
        });
      }

      const newGrave = await tx.grave.create({
        data: {
          deceasedName,
          plotId,
          tier,
          burialDate: burialDate ? new Date(burialDate) : null,
          birthDate: birthDate ? new Date(birthDate) : null,
          deathDate: deathDate ? new Date(deathDate) : null,
          status: "active",
        },
      });

      if (encryptedDetail) {
        await tx.graveDetail.create({
          data: {
            graveId: newGrave.id,
            causeOfDeath: encryptedDetail.causeOfDeath,
            contactPerson: encryptedDetail.contactPerson,
            contactPhone: encryptedDetail.contactPhone,
            notes: encryptedDetail.notes,
            encryptionKeyVersion: encryptedDetail.encryptionKeyVersion,
            notesEncrypted: encryptedDetail.notesEncrypted,
          },
        });
      }

      const grave = await tx.grave.findUnique({
        where: { id: newGrave.id },
        include: {
          plot: {
            include: {
              locationDetail: { include: { location: true } },
              photos: { select: { tier: true, url: true } },
            },
          },
          details: true,
        },
      });
      return { grave };
    });

    if (transactionResult.claimError) {
      return NextResponse.json(
        { error: transactionResult.claimError.message },
        { status: transactionResult.claimError.status }
      );
    }
    const { grave } = transactionResult;

    // Audit after the mutation is committed (Req 14.1).
    await writeAuditLog({
      userId: user.id,
      action: "grave.create",
      ipAddress: getClientIp(request),
    });

    // The creator is authorized to view sensitive fields — return plaintext (Req 3.2).
    return NextResponse.json(exposeGraveDetails(grave, true), { status: 201 });
  } catch (error) {
    if (error instanceof EncryptionKeyError) {
      return encryptionErrorResponse("Encryption key is unavailable or invalid");
    }
    if (error instanceof DecryptionError) {
      return encryptionErrorResponse("A stored value could not be decrypted");
    }
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "This plot already has a grave record" },
        { status: 409 }
      );
    }
    console.error("POST /api/graves error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
