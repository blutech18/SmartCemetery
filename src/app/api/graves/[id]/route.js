import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { validateBody, validationErrorResponse } from "@/lib/validation";
import {
  decryptGraveDetail,
  encryptGraveDetail,
  DecryptionError,
  EncryptionKeyError,
} from "@/lib/encryption";
import { shouldArchive } from "@/lib/archival";
import { getClientIp, writeAuditLog } from "@/lib/audit";
import { MAX_TIERS } from "@/lib/cemetery-layout";

const UPDATE_GRAVE_SCHEMA = {
  deceasedName: { type: "string", trim: true, min: 1, max: 200 },
  plotId: { type: "integer", min: 1 },
  tier: { type: "integer", min: 1, max: MAX_TIERS },
};
const DETAIL_LIMITS = {
  causeOfDeath: 5000,
  contactPerson: 500,
  contactPhone: 100,
  notes: 10000,
};
const CORE_FIELDS = ["deceasedName", "plotId", "burialDate", "tier"];
// Life dates are plain columns; editing them does not reset verification.
const DATE_FIELDS = ["birthDate", "deathDate"];
const DETAIL_FIELDS = Object.keys(DETAIL_LIMITS);
const ALLOWED_FIELDS = [...CORE_FIELDS, ...DATE_FIELDS, ...DETAIL_FIELDS];

class TransactionConflict extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function errorResponse(status, message, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function dateValue(value) {
  if (value === null || value === "") return { value: null };
  if (typeof value !== "string" || !value.trim()) return { error: true };
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? { error: true } : { value: parsed };
}
function validatePatch(body) {
  const supplied = ALLOWED_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(body, field)
  );
  const errors = [];
  if (supplied.length === 0) {
    errors.push({ field: "body", code: "required", message: "At least one grave field is required" });
  }

  const coreSource = {};
  for (const field of ["deceasedName", "plotId", "tier"]) {
    if (Object.prototype.hasOwnProperty.call(body, field)) coreSource[field] = body[field];
  }
  const core = validateBody(coreSource, UPDATE_GRAVE_SCHEMA);
  if (!core.valid) errors.push(...core.errors);
  if (Object.prototype.hasOwnProperty.call(body, "deceasedName") && !body.deceasedName?.trim?.()) {
    errors.push({ field: "deceasedName", code: "required", message: "deceasedName is required" });
  }

  let burialDate;
  if (Object.prototype.hasOwnProperty.call(body, "burialDate")) {
    const parsed = dateValue(body.burialDate);
    if (parsed.error) {
      errors.push({ field: "burialDate", code: "type", message: "burialDate must be a valid date or null" });
    } else {
      burialDate = parsed.value;
    }
  }

  const lifeDates = {};
  for (const field of DATE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const parsed = dateValue(body[field]);
    if (parsed.error) {
      errors.push({ field, code: "type", message: `${field} must be a valid date or null` });
    } else {
      lifeDates[field] = parsed.value;
    }
  }

  const details = {};
  for (const field of DETAIL_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) continue;
    const value = body[field];
    if (value === null || value === "") {
      details[field] = null;
    } else if (typeof value !== "string") {
      errors.push({ field, code: "type", message: `${field} must be of type string` });
    } else if (value.trim().length > DETAIL_LIMITS[field]) {
      errors.push({ field, code: "max", message: `${field} must be at most ${DETAIL_LIMITS[field]} characters` });
    } else {
      details[field] = value.trim();
    }
  }

  return {
    errors,
    value: {
      ...(core.valid ? core.value : {}),
      ...(Object.prototype.hasOwnProperty.call(body, "burialDate") ? { burialDate } : {}),
      ...lifeDates,
    },
    details,
    detailTouched: DETAIL_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(body, field)),
    coreTouched: CORE_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(body, field)),
  };
}

function encryptionError(error) {
  if (error instanceof EncryptionKeyError) {
    return errorResponse(500, "Encryption key is unavailable or invalid");
  }
  if (error instanceof DecryptionError) {
    return errorResponse(500, "A stored value could not be decrypted");
  }
  return null;
}
export async function PATCH(request, { params }) {
  const auth = await requireRole(request, "graves");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const graveId = parseId(id);
  if (!graveId) {
    return validationErrorResponse([
      { field: "id", code: "type", message: "id must be a positive integer" },
    ]);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const validation = validatePatch(body);
  if (validation.errors.length) return validationErrorResponse(validation.errors);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.grave.findUnique({
        where: { id: graveId },
        include: { details: true },
      });
      if (!existing) return { error: "not_found" };
      if (existing.status === "archived") return { error: "archived" };

      const nextPlotId = validation.value.plotId;
      const nextTier = validation.value.tier ?? existing.tier ?? 1;
      const movingPlots = nextPlotId !== undefined && nextPlotId !== existing.plotId;
      const changingTier = validation.value.tier !== undefined && nextTier !== existing.tier;

      // The destination tier must exist in the destination plot.
      if (movingPlots || changingTier) {
        const destination = await tx.plot.findUnique({
          where: { id: movingPlots ? nextPlotId : existing.plotId },
          select: { totalTiers: true },
        });
        if (destination && Number.isFinite(destination.totalTiers) && nextTier > destination.totalTiers) {
          return { error: "tier_invalid", tier: nextTier, totalTiers: destination.totalTiers };
        }
      }

      if (movingPlots) {
        // For multi-tier plots, check that the specific tier is free
        const tierTaken = await tx.grave.findFirst({
          where: { plotId: nextPlotId, tier: nextTier, id: { not: graveId } },
          select: { id: true },
        });
        if (tierTaken) {
          return { error: "tier_occupied", tier: nextTier };
        }

        const claim = await tx.plot.updateMany({
          where: { id: nextPlotId, status: "available" },
          data: { status: "occupied" },
        });
        // Plot may already be occupied by another tier — that's fine
        const target = await tx.plot.findUnique({
          where: { id: nextPlotId },
          select: { status: true },
        });
        if (!target) {
          return { error: "plot_not_found" };
        }
        if (target.status === "maintenance") {
          return { error: "plot_maintenance" };
        }
      } else if (changingTier) {
        // Check that the new tier on the same plot is free
        const tierTaken = await tx.grave.findFirst({
          where: { plotId: existing.plotId, tier: nextTier, id: { not: graveId } },
          select: { id: true },
        });
        if (tierTaken) {
          return { error: "tier_occupied", tier: nextTier };
        }
      }

      let encryptedDetails;
      if (validation.detailTouched) {
        const plaintext = existing.details
          ? decryptGraveDetail(existing.details)
          : {};
        encryptedDetails = encryptGraveDetail({
          causeOfDeath: plaintext.causeOfDeath ?? null,
          contactPerson: plaintext.contactPerson ?? null,
          contactPhone: plaintext.contactPhone ?? null,
          notes: plaintext.notes ?? null,
          ...validation.details,
        });
      }

      const graveData = { ...validation.value, tier: nextTier };
      if (validation.coreTouched) {
        graveData.verificationStatus = "pending";
        graveData.verifiedAt = null;
        graveData.verifiedById = null;
        graveData.verificationNote = null;
      }
      await tx.grave.update({ where: { id: graveId }, data: graveData });

      if (movingPlots) {
        // Only release the old plot when no other graves remain on it
        const remainingOnOld = await tx.grave.count({
          where: { plotId: existing.plotId },
        });
        if (remainingOnOld === 0) {
          await tx.plot.updateMany({
            where: { id: existing.plotId, status: "occupied" },
            data: { status: "available" },
          });
        }
      }
      if (encryptedDetails) {
        const detailData = {
          causeOfDeath: encryptedDetails.causeOfDeath,
          contactPerson: encryptedDetails.contactPerson,
          contactPhone: encryptedDetails.contactPhone,
          notes: encryptedDetails.notes,
          encryptionKeyVersion: encryptedDetails.encryptionKeyVersion,
          notesEncrypted: encryptedDetails.notesEncrypted,
        };
        await tx.graveDetail.upsert({
          where: { graveId },
          create: { graveId, ...detailData },
          update: detailData,
        });
      }

      const updated = await tx.grave.findUnique({
        where: { id: graveId },
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
      return { updated };
    });

    if (result.error === "not_found") return errorResponse(404, "Grave not found");
    if (result.error === "archived") return errorResponse(409, "Archived graves cannot be updated");
    if (result.error === "plot_not_found") return errorResponse(404, "Plot not found");
    if (result.error === "plot_maintenance") {
      return errorResponse(409, "The destination plot is under maintenance");
    }
    if (result.error === "plot_unavailable") {
      return errorResponse(409, `Plot is currently ${result.plotStatus}`);
    }
    if (result.error === "tier_invalid") {
      return errorResponse(400, `Tier ${result.tier} does not exist: this plot has ${result.totalTiers} tier(s)`);
    }
    if (result.error === "tier_occupied") {
      return errorResponse(409, `Tier ${result.tier} is already occupied for this plot`);
    }

    const responseGrave = result.updated?.details
      ? { ...result.updated, details: decryptGraveDetail(result.updated.details) }
      : result.updated;
    await writeAuditLog({
      userId: auth.user.id,
      action: "grave.update",
      ipAddress: getClientIp(request),
    });
    return NextResponse.json(responseGrave);
  } catch (error) {
    const secureError = encryptionError(error);
    if (secureError) return secureError;
    if (error instanceof TransactionConflict) {
      return errorResponse(error.status, error.message, error.extra);
    }
    if (error?.code === "P2002") return errorResponse(409, "Plot already has a grave record");
    console.error("PATCH /api/graves/[id] error:", error);
    return errorResponse(500, "Failed to update grave");
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireRole(request, "graves");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const graveId = parseId(id);
  if (!graveId) {
    return validationErrorResponse([
      { field: "id", code: "type", message: "id must be a positive integer" },
    ]);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const grave = await tx.grave.findUnique({
        where: { id: graveId },
        select: { id: true, plotId: true, status: true, burialDate: true },
      });
      if (!grave) return { error: "not_found" };
      if (grave.status === "archived") return { error: "archived" };
      if (shouldArchive(grave.burialDate, new Date())) return { error: "retention" };

      await tx.grave.delete({ where: { id: graveId } });

      // Only release the plot when no other graves remain (multi-tier plots
      // may still have other occupied tiers).
      const remainingGraves = await tx.grave.count({
        where: { plotId: grave.plotId, id: { not: graveId } },
      });
      if (remainingGraves === 0) {
        await tx.plot.updateMany({
          where: { id: grave.plotId, status: "occupied" },
          data: { status: "available" },
        });
      }
      return { deletedId: graveId };
    });

    if (result.error === "not_found") return errorResponse(404, "Grave not found");
    if (result.error === "archived") return errorResponse(409, "Archived graves can never be deleted");
    if (result.error === "retention") {
      return errorResponse(409, "Graves older than five years must be archived and retained");
    }

    await writeAuditLog({
      userId: auth.user.id,
      action: "grave.delete",
      ipAddress: getClientIp(request),
    });
    return NextResponse.json({ success: true, id: result.deletedId });
  } catch (error) {
    if (error instanceof TransactionConflict) {
      return errorResponse(error.status, error.message, error.extra);
    }
    console.error("DELETE /api/graves/[id] error:", error);
    return errorResponse(500, "Failed to delete grave");
  }
}