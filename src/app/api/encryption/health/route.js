import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import {
  assertKeyValid,
  EncryptionKeyError,
  getCurrentKeyVersion,
} from "@/lib/encryption";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireRole(request, "encryption");
  if (!auth.ok) return auth.response;

  try {
    const currentVersion = getCurrentKeyVersion();
    assertKeyValid(currentVersion);
    const groups = await prisma.graveDetail.groupBy({
      by: ["encryptionKeyVersion", "notesEncrypted"],
      _count: { _all: true },
    });
    const versions = [...new Set(groups.map((group) => group.encryptionKeyVersion))]
      .map((version) => {
        try {
          assertKeyValid(version);
          return { version, keyAvailable: true };
        } catch {
          return { version, keyAvailable: false };
        }
      });
    const pendingRows = groups
      .filter((group) => group.encryptionKeyVersion !== currentVersion || !group.notesEncrypted)
      .reduce((total, group) => total + group._count._all, 0);

    return NextResponse.json({
      healthy: versions.every((item) => item.keyAvailable),
      currentVersion,
      pendingRows,
      versions,
    });
  } catch (error) {
    const message = error instanceof EncryptionKeyError
      ? "Current encryption key is unavailable or invalid"
      : "Encryption health check failed";
    return NextResponse.json({ healthy: false, error: message }, { status: 503 });
  }
}