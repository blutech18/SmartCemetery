import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/authz";
import { encryptGraveDetail } from "@/lib/encryption";
import { getClientIp, writeAuditLog } from "@/lib/audit";
import path from "node:path";
import fs from "node:fs";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request, { params }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  if (auth.user.role !== "Admin" && auth.user.role !== "Staff") {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  const { id } = await params;
  const plotId = Number(id);
  if (!Number.isInteger(plotId) || plotId <= 0) {
    return NextResponse.json({ error: "Invalid plot ID" }, { status: 400 });
  }

  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: {
      locationDetail: true,
      graves: { include: { details: true } },
    },
  });

  if (!plot) {
    return NextResponse.json({ error: "Plot record not found" }, { status: 404 });
  }

  // If plot already has a grave, forward ID
  let grave = plot.graves?.[0];
  if (!grave) {
    // Initialize an apartment or lot grave container for the plot
    const isRowPlot = plot.plotNumber?.startsWith("ROW-") || plot.locationDetail?.subsection?.startsWith("ROW-");
    const notesContent = isRowPlot
      ? JSON.stringify({
          type: "apartment_niche_stack",
          structureName: `${plot.plotNumber} Crypt`,
          totalTiers: 4,
          occupiedCount: 0,
          availableCount: 4,
          tiers: [
            { tier: 1, label: "Tier 1 (Ground Level)", status: "available" },
            { tier: 2, label: "Tier 2 (Second Level)", status: "available" },
            { tier: 3, label: "Tier 3 (Third Level)", status: "available" },
            { tier: 4, label: "Tier 4 (Top Level)", status: "available" },
          ],
        })
      : JSON.stringify({ type: "traditional_plot" });

    grave = await prisma.grave.create({
      data: {
        plotId: plot.id,
        deceasedName: `Plot ${plot.plotNumber}`,
        status: plot.status || "available",
        verificationStatus: "verified",
        details: {
          create: encryptGraveDetail({ notes: notesContent }),
        },
      },
      include: { details: true },
    });
  }

  // Now forward handling to the grave photo endpoint logic
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
        const filename = `plot-${plotId}-${Date.now()}.${ext}`;
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

  // Update grave details
  let currentNotes = grave.details?.notes || "";
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
      const target = parsed.tiers.find((t) => t.status === "occupied") || parsed.tiers[0];
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
        notes: encrypted.notes,
        notesEncrypted: encrypted.notesEncrypted,
        encryptionKeyVersion: encrypted.encryptionKeyVersion,
      },
    });
  }

  await writeAuditLog({
    userId: auth.user.id,
    action: "plot.photo_update",
    resourceId: String(plot.id),
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
