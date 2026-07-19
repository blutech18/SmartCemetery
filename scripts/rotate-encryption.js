import { PrismaClient } from "@prisma/client";
import {
  decryptGraveDetail,
  encryptGraveDetail,
  getCurrentKeyVersion,
} from "../src/lib/encryption.js";

const prisma = new PrismaClient();
const batchSize = 100;

async function main() {
  if (process.env.ROTATE_ENCRYPTION_CONFIRM !== "rotate") {
    throw new Error("Set ROTATE_ENCRYPTION_CONFIRM=rotate to run key rotation");
  }

  const currentVersion = getCurrentKeyVersion();
  let cursor = 0;
  let rotated = 0;

  while (true) {
    const rows = await prisma.graveDetail.findMany({
      where: {
        id: { gt: cursor },
        OR: [
          { encryptionKeyVersion: { not: currentVersion } },
          { notesEncrypted: false },
        ],
      },
      orderBy: { id: "asc" },
      take: batchSize,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const plaintext = decryptGraveDetail(row);
      const encrypted = encryptGraveDetail(plaintext);
      await prisma.graveDetail.update({
        where: { id: row.id },
        data: {
          causeOfDeath: encrypted.causeOfDeath,
          contactPerson: encrypted.contactPerson,
          contactPhone: encrypted.contactPhone,
          notes: encrypted.notes,
          encryptionKeyVersion: encrypted.encryptionKeyVersion,
          notesEncrypted: encrypted.notesEncrypted,
        },
      });
      cursor = row.id;
      rotated += 1;
    }

    console.info(`Rotated ${rotated} grave detail rows`);
  }

  console.info(`Encryption rotation complete at version ${currentVersion}; rows=${rotated}`);
}
main()
  .catch((error) => {
    console.error("Encryption rotation failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });