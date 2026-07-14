import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { smartSearch } from "@/lib/search";
import { requireRole } from "@/lib/authz";
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

// Sensitive GraveDetail fields that must never be exposed to unauthenticated callers.
const SENSITIVE_DETAIL_FIELDS = ["contactPerson", "contactPhone", "causeOfDeath"];

// Uniform encryption-error response (Req 3.3, 3.4). Shape matches the platform
// error envelope: { error: { type, message } }.
function encryptionErrorResponse(message) {
  return NextResponse.json(
    { error: { type: "encryption", message } },
    { status: 500 }
  );
}

// Remove sensitive fields from a GraveDetail so unauthenticated callers never
// receive encrypted (or plaintext) sensitive values.
function stripSensitiveDetail(detail) {
  if (!detail) return detail;
  const result = { ...detail };
  for (const field of SENSITIVE_DETAIL_FIELDS) {
    if (field in result) delete result[field];
  }
  return result;
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
};

// GET /api/graves — List graves or search
export async function GET(request) {
  try {
    // Public path: never reject. We only use the guard result to decide whether
    // sensitive detail fields may be exposed as decrypted plaintext.
    const authz = await requireRole(request, "graves");
    const authorized = authz.ok;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const status = searchParams.get("status");
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
      const results = await smartSearch(prisma, query);
      return NextResponse.json({
        exact: results.exact.map((g) => exposeGraveDetails(g, authorized)),
        suggestions: results.suggestions.map((g) => exposeGraveDetails(g, authorized)),
      });
    }

    // Bulk listing is restricted to cemetery personnel. Public callers use the
    // bounded search mode above rather than enumerating the full registry.
    const listAuth = await requireRole(request, "verify");
    if (!listAuth.ok) return listAuth.response;

    // List mode with pagination
    const where = {};
    if (status) where.status = status;

    const [graves, total] = await Promise.all([
      prisma.grave.findMany({
        where,
        include: {
          plot: {
            include: {
              locationDetail: {
                include: { location: true },
              },
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
    if (error instanceof DecryptionError) {
      return encryptionErrorResponse("A stored value could not be decrypted");
    }
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
    const { deceasedName, plotId } = validation.value;
    const { burialDate, causeOfDeath, contactPerson, contactPhone, notes, confirm } = body;

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

    // Claim the plot and create its grave in the same transaction. updateMany
    // performs a compare-and-set on status, so concurrent requests cannot both
    // claim an available plot. The DB unique constraint on Grave.plotId is the
    // final invariant if a plot status ever becomes inconsistent.
    const transactionResult = await prisma.$transaction(async (tx) => {
      const claim = await tx.plot.updateMany({
        where: { id: plotId, status: "available" },
        data: { status: "occupied" },
      });

      if (claim.count !== 1) {
        const existingPlot = await tx.plot.findUnique({
          where: { id: plotId },
          select: { status: true },
        });
        return {
          claimError: existingPlot
            ? { status: 409, message: `Plot is currently ${existingPlot.status}` }
            : { status: 404, message: "Plot not found" },
        };
      }

      const newGrave = await tx.grave.create({
        data: {
          deceasedName,
          plotId,
          burialDate: burialDate ? new Date(burialDate) : null,
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
          },
        });
      }

      const grave = await tx.grave.findUnique({
        where: { id: newGrave.id },
        include: {
          plot: { include: { locationDetail: { include: { location: true } } } },
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
