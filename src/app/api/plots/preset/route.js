import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { getClientIp, writeAuditLog } from "@/lib/audit";
import { encryptGraveDetail } from "@/lib/encryption";
import { BOLONSORI_PRESET, BOLONSORI_DELETED_ROWS } from "@/lib/bolonsori-preset";

const sampleDeceased = [
  { name: "Beatriz Walag", date: "2018-03-20", cause: "Natural Causes / Old Age", kin: "Nimfa Walag (Daughter)" },
  { name: "Nimfa Walag", date: "2021-10-14", cause: "Cardiopulmonary Arrest", kin: "Roberto Walag (Son)" },
  { name: "Ramon Magsaysay V", date: "2019-05-12", cause: "Pneumonia", kin: "Maria Magsaysay" },
  { name: "Teodoro Agoncillo", date: "2020-08-22", cause: "Heart Failure", kin: "Elena Agoncillo" },
  { name: "Marcelo H. Del Pilar II", date: "2017-11-04", cause: "Hypertension", kin: "Sofia Del Pilar" },
  { name: "Clara Recto", date: "2022-01-19", cause: "Chronic Kidney Disease", kin: "Antonio Recto" },
  { name: "Geronimo Berenguer", date: "2019-09-30", cause: "Respiratory Failure", kin: "Lourdes Berenguer" },
  { name: "Corazon Aquino-Santos", date: "2023-04-15", cause: "Cardiac Arrest", kin: "Ferdinand Santos" },
  { name: "Diosdado Macapagal Jr.", date: "2020-12-05", cause: "Complications of Diabetes", kin: "Evangeline Macapagal" },
  { name: "Esteban Rodriguez", date: "2021-07-08", cause: "Myocardial Infarction", kin: "Carmela Rodriguez" },
  { name: "Salvador Laurel III", date: "2018-06-25", cause: "Cerebrovascular Disease", kin: "Beatrice Laurel" },
  { name: "Teresa Magbanua-Cruz", date: "2022-11-18", cause: "Multiple Organ Failure", kin: "Manuel Cruz" },
];

export async function POST(request) {
  try {
    const authz = await requireRole(request, "layout");
    if (!authz.ok) return authz.response;
    const userId = authz.user.id;

    // 1. Ensure City Memorial Park location exists
    let cmpLocation = await prisma.location.findFirst({
      where: { name: { contains: "City Memorial Park" } },
      include: { details: true },
    });

    if (!cmpLocation) {
      cmpLocation = await prisma.location.create({
        data: {
          name: "City Memorial Park (CMP) - Bolonsiri",
          description: "Public cemetery redevelopment area featuring multi-tier apartment crypts, administrative offices, and memorial rows in Camaman-an, Cagayan de Oro.",
          gpsLat: 8.46571,
          gpsLng: 124.65700,
        },
      });
    } else {
      await prisma.location.update({
        where: { id: cmpLocation.id },
        data: {
          gpsLat: 8.46571,
          gpsLng: 124.65700,
        },
      });
    }

    const admin = await prisma.user.findFirst({
      where: { userType: { typeName: "Admin" } },
    });
    const adminId = admin ? admin.id : userId;

    let sampleIdx = 2;
    const activePlotNumbers = new Set();
    const activeRowKeys = Object.keys(BOLONSORI_PRESET.rows);

    // 2. Upsert each row section and plot in the preset
    for (let rIdx = 0; rIdx < activeRowKeys.length; rIdx++) {
      const rowCode = activeRowKeys[rIdx];
      const rowData = BOLONSORI_PRESET.rows[rowCode];

      let sectionDetail = await prisma.locationDetail.findFirst({
        where: {
          locationId: cmpLocation.id,
          subsection: rowCode,
        },
      });

      if (!sectionDetail) {
        sectionDetail = await prisma.locationDetail.create({
          data: {
            locationId: cmpLocation.id,
            subsection: rowCode,
            capacity: rowData.plotCount * 4,
            sortOrder: rIdx + 1,
          },
        });
      } else {
        await prisma.locationDetail.update({
          where: { id: sectionDetail.id },
          data: {
            capacity: rowData.plotCount * 4,
            sortOrder: rIdx + 1,
          },
        });
      }

      for (let pIdx = 0; pIdx < rowData.plots.length; pIdx++) {
        const pDef = rowData.plots[pIdx];
        activePlotNumbers.add(pDef.plotNumber);

        const isWalagGrave = pDef.plotNumber === "WALAG-001";
        const status = pDef.status || "available";

        const plot = await prisma.plot.upsert({
          where: {
            locationDetailId_plotNumber: {
              locationDetailId: sectionDetail.id,
              plotNumber: pDef.plotNumber,
            },
          },
          update: {
            gpsLat: pDef.lat,
            gpsLng: pDef.lng,
            status,
          },
          create: {
            locationDetailId: sectionDetail.id,
            plotNumber: pDef.plotNumber,
            status,
            gpsLat: pDef.lat,
            gpsLng: pDef.lng,
          },
          include: { graves: { include: { details: true } } },
        });

        // Seed Beatriz & Nimfa Walag Grave if missing
        if (isWalagGrave && (!plot.graves || plot.graves.length === 0)) {
          const walagTiers = [
            {
              tier: 1,
              label: "Tier 1 (Ground Level)",
              deceasedName: "Beatriz Walag",
              burialDate: "2018-03-20T00:00:00.000Z",
              deathDate: "2018-03-16",
              causeOfDeath: "Natural Causes / Old Age (Age: 84)",
              contactPerson: "Nimfa Walag (Daughter)",
              contactPhone: "+63 917 555 0192",
              status: "occupied",
              notes: "Beloved mother and grandmother. Resting in peace with daughter Nimfa.",
            },
            {
              tier: 2,
              label: "Tier 2 (Second Level)",
              deceasedName: "Nimfa Walag",
              burialDate: "2021-10-14T00:00:00.000Z",
              deathDate: "2021-10-10",
              causeOfDeath: "Cardiopulmonary Arrest (Age: 62)",
              contactPerson: "Roberto Walag (Son)",
              contactPhone: "+63 918 333 4455",
              status: "occupied",
              notes: "Cherished educator, mother, and sister. Forever remembered.",
            },
            {
              tier: 3,
              label: "Tier 3 (Third Level)",
              status: "available",
              notes: "Reserved for family member.",
            },
            {
              tier: 4,
              label: "Tier 4 (Top Level)",
              status: "available",
              notes: "Unoccupied apartment niche crypt.",
            },
          ];

          const notesContent = JSON.stringify({
            type: "apartment_niche_stack",
            structureName: "Beatriz and Nimfa Walag Grave",
            totalTiers: 4,
            occupiedCount: 2,
            availableCount: 2,
            tiers: walagTiers,
          });

          await prisma.grave.create({
            data: {
              plotId: plot.id,
              deceasedName: "Beatriz and Nimfa Walag",
              burialDate: new Date("2021-10-14"),
              status: "active",
              verificationStatus: "verified",
              verifiedAt: new Date(),
              verifiedById: adminId,
              verificationNote: "Verified family multi-tier apartment crypt (Beatriz Walag - Tier 1, Nimfa Walag - Tier 2)",
              details: {
                create: encryptGraveDetail({
                  causeOfDeath: "Tier 1: Natural Causes | Tier 2: Cardiopulmonary Arrest",
                  contactPerson: "Roberto Walag (Family Representative)",
                  contactPhone: "+63 918 333 4455",
                  notes: notesContent,
                }),
              },
            },
          });
        } else if (!isWalagGrave && plot.status === "occupied" && (!plot.graves || plot.graves.length === 0)) {
          const dec1 = sampleDeceased[sampleIdx % sampleDeceased.length];
          sampleIdx++;
          const dec2 = pIdx % 2 === 0 ? sampleDeceased[sampleIdx % sampleDeceased.length] : null;
          if (dec2) sampleIdx++;

          const tiers = [
            {
              tier: 1,
              label: "Tier 1 (Ground Level)",
              deceasedName: dec1.name,
              burialDate: `${dec1.date}T00:00:00.000Z`,
              causeOfDeath: dec1.cause,
              contactPerson: dec1.kin,
              status: "occupied",
            },
            {
              tier: 2,
              label: "Tier 2 (Second Level)",
              deceasedName: dec2 ? dec2.name : null,
              burialDate: dec2 ? `${dec2.date}T00:00:00.000Z` : null,
              causeOfDeath: dec2 ? dec2.cause : null,
              contactPerson: dec2 ? dec2.kin : null,
              status: dec2 ? "occupied" : "available",
            },
            {
              tier: 3,
              label: "Tier 3 (Third Level)",
              status: "available",
            },
            {
              tier: 4,
              label: "Tier 4 (Top Level)",
              status: "available",
            },
          ];

          const notesContent = JSON.stringify({
            type: "apartment_niche_stack",
            structureName: `${rowCode} Column ${pIdx + 1} Crypt`,
            totalTiers: 4,
            occupiedCount: dec2 ? 2 : 1,
            availableCount: dec2 ? 2 : 3,
            tiers,
          });

          await prisma.grave.create({
            data: {
              plotId: plot.id,
              deceasedName: dec2 ? `${dec1.name} & ${dec2.name}` : dec1.name,
              burialDate: new Date(dec1.date),
              status: "active",
              verificationStatus: "verified",
              verifiedAt: new Date(),
              verifiedById: adminId,
              verificationNote: "Verified cemetery municipal record (Apartment Crypt)",
              details: {
                create: encryptGraveDetail({
                  causeOfDeath: dec1.cause,
                  contactPerson: dec1.kin,
                  contactPhone: "+63 917 555 " + String(1000 + sampleIdx).slice(1),
                  notes: notesContent,
                }),
              },
            },
          });
        }
      }
    }

    // 3. Handle Deleted Rows (ROW-W01, ROW-W02, ROW-W04)
    for (const delRow of BOLONSORI_DELETED_ROWS) {
      const detail = await prisma.locationDetail.findFirst({
        where: { locationId: cmpLocation.id, subsection: delRow },
        include: { plots: { include: { graves: true } } },
      });
      if (detail && Array.isArray(detail.plots)) {
        for (const p of detail.plots) {
          if (p.graves && p.graves.length > 0) {
            await prisma.plot.update({
              where: { id: p.id },
              data: { gpsLat: null, gpsLng: null },
            });
          } else {
            await prisma.plot.delete({ where: { id: p.id } });
          }
        }
      }
    }

    // 4. Clean up excess empty plots outside preset
    const allPlotsInCMP = await prisma.plot.findMany({
      where: { locationDetail: { locationId: cmpLocation.id }, gpsLat: { not: null } },
      include: { graves: true },
    });

    for (const p of allPlotsInCMP) {
      if (!activePlotNumbers.has(p.plotNumber)) {
        if (p.graves && p.graves.length > 0) {
          await prisma.plot.update({
            where: { id: p.id },
            data: { gpsLat: null, gpsLng: null },
          });
        } else {
          await prisma.plot.delete({ where: { id: p.id } });
        }
      }
    }

    // 5. Write audit log
    await writeAuditLog({
      userId,
      action: "plot.preset",
      resourceId: String(cmpLocation.id),
      ipAddress: getClientIp(request),
      details: {
        presetName: BOLONSORI_PRESET.name,
        totalPlots: 119,
        activeRows: activeRowKeys.length,
      },
    });

    // 6. Fetch complete, fresh dynamic plots for CMP to return to the client
    const freshPlots = await prisma.plot.findMany({
      where: { locationDetail: { locationId: cmpLocation.id } },
      include: {
        locationDetail: {
          include: { location: true },
        },
        graves: {
          include: { details: true },
        },
      },
      orderBy: [{ locationDetail: { subsection: "asc" } }, { plotNumber: "asc" }],
    });

    return NextResponse.json({
      ok: true,
      message: "Bolonsiri Master Preset successfully applied and saved to database!",
      totalPlots: 119,
      plots: freshPlots,
    });
  } catch (err) {
    console.error("POST /api/plots/preset error:", err);
    return NextResponse.json(
      { error: "Failed to apply Bolonsiri plot preset", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
