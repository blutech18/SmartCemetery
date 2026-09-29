import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authz";
import { decryptGraveDetail, encryptGraveDetail } from "@/lib/encryption";
import { getClientIp, writeAuditLog } from "@/lib/audit";
import path from "node:path";
import fs from "node:fs";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  // Only Admin and Staff may edit grave photos
  if (auth.user.role !== "Admin" && auth.user.role !== "Staff") {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const graveId = Number(id);
  if (!Number.isInteger(graveId) || graveId <= 0) {
    return NextResponse.json({ error: "Invalid grave ID" }, { status: 400 });
  }

  const grave = await prisma.grave.findUnique({
    where: { id: graveId },
    include: { details: true, plot: { include: { locationDetail: true } } },
  });

  if (!grave) {
    return NextResponse.json({ error: "Grave record not found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") || "";
  let photoUrl = null;
  let tier = null;
  let applyToAll = false;

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const file = formData.get("file");
      tier = formData.get("tier");
      applyToAll = formData.get("applyToAll") === "true";
      photoUrl = formData.get("photoUrl") || null;

      if (file && typeof file === "object" && typeof file.arrayBuffer === "function") {
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
          return NextResponse.json(
            { error: "Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed." },
            { status: 400 }
          );
        }

        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: "File exceeds 5MB size limit." },
            { status: 400 }
          );
        }

        const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
        const filename = `grave-${graveId}-${Date.now()}.${ext}`;
        const uploadDir = path.join(process.cwd(), "public", "uploads", "graves");
        await fs.promises.mkdir(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, filename);

        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.promises.writeFile(filePath, buffer);
        photoUrl = `/uploads/graves/${filename}`;
      }
    } catch (err) {
      console.error("Failed to parse form data:", err);
      return NextResponse.json({ error: "Failed to upload image file" }, { status: 400 });
    }
  } else {
    try {
      const body = await request.json();
      photoUrl = body.photoUrl || null;
      tier = body.tier ?? null;
      applyToAll = Boolean(body.applyToAll);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  if (photoUrl === "reset" || photoUrl === "") {
    photoUrl = null;
  }

  // Decrypt current details
  let decrypted = null;
  if (grave.details) {
    try {
      decrypted = decryptGraveDetail(grave.details);
    } catch {
      decrypted = grave.details;
    }
  }

  let currentNotes = decrypted?.notes || "";
  let parsed = null;
  try {
    parsed = JSON.parse(currentNotes);
  } catch {
    parsed = null;
  }

  if (parsed && parsed.type === "apartment_niche_stack" && Array.isArray(parsed.tiers)) {
    if (applyToAll) {
      parsed.photo = photoUrl;
      parsed.tiers = parsed.tiers.map((t) => ({ ...t, photo: photoUrl }));
    } else if (tier != null) {
      const tNum = Number(tier);
      const target = parsed.tiers.find((t) => t.tier === tNum);
      if (target) {
        target.photo = photoUrl;
      }
      if (!parsed.photo || photoUrl === null) {
        parsed.photo = photoUrl;
      }
    } else {
      // General photo update: apply to stack structure and target occupant tier
      parsed.photo = photoUrl;
      const target = parsed.tiers.find((t) => t.deceasedName && t.deceasedName === grave.deceasedName)
        || parsed.tiers.find((t) => t.status === "occupied")
        || parsed.tiers[0];
      if (target) {
        target.photo = photoUrl;
      }
    }
    currentNotes = JSON.stringify(parsed);
  } else {
    if (parsed && typeof parsed === "object") {
      parsed.photo = photoUrl;
      currentNotes = JSON.stringify(parsed);
    } else {
      currentNotes = JSON.stringify({
        photo: photoUrl,
        text: currentNotes || "",
      });
    }
  }

  const encrypted = encryptGraveDetail({
    causeOfDeath: decrypted?.causeOfDeath ?? null,
    contactPerson: decrypted?.contactPerson ?? null,
    contactPhone: decrypted?.contactPhone ?? null,
    notes: currentNotes,
  });

  if (grave.details) {
    await prisma.graveDetail.update({
      where: { id: grave.details.id },
      data: {
        notes: encrypted.notes,
        notesEncrypted: encrypted.notesEncrypted,
        encryptionKeyVersion: encrypted.encryptionKeyVersion,
      },
    });
  } else {
    await prisma.graveDetail.create({
      data: {
        graveId: grave.id,
        causeOfDeath: encrypted.causeOfDeath,
        contactPerson: encrypted.contactPerson,
        contactPhone: encrypted.contactPhone,
        notes: encrypted.notes,
        notesEncrypted: encrypted.notesEncrypted,
        encryptionKeyVersion: encrypted.encryptionKeyVersion,
      },
    });
  }

  await writeAuditLog({
    userId: auth.user.id,
    action: "grave.photo_update",
    resourceId: String(grave.id),
    ipAddress: getClientIp(request),
    details: { photoUrl, tier, applyToAll },
  });

  return NextResponse.json({
    ok: true,
    photoUrl,
    tier,
    message: photoUrl ? "Photo updated successfully" : "Photo reset to default",
    notes: currentNotes,
  });
}
