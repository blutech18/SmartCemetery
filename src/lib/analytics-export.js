import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";

function periodLabel(period) {
  return `${period.from.slice(0, 10)} to ${period.to.slice(0, 10)}`;
}

function sections(analytics) {
  return [
    ["Summary", [
      ["Audit actions", analytics.totals.auditActions],
      ["Navigation events", analytics.totals.navigations],
    ]],
    ["Audit actions", analytics.auditActions.map((row) => [row.action, row.count])],
    ["Navigation by day", analytics.navigation.daily.map((row) => [row.date, row.count])],
    ["Navigation channels", analytics.navigation.channels.map((row) => [row.channel, row.count])],
    ["Destination groups", analytics.navigation.destinations.map((row) => [row.destination, row.count])],
  ];
}

export function renderAnalyticsPdf(analytics, period) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.fontSize(20).text("Smart Cemetery — Operations Analytics", { align: "center" });
      doc.moveDown(0.5).fontSize(11).fillColor("#555")
        .text(`Period: ${periodLabel(period)}`, { align: "center" });
      doc.fillColor("#000").moveDown();
      for (const [title, rows] of sections(analytics)) {
        doc.fontSize(14).text(title, { underline: true }).moveDown(0.25).fontSize(10);
        if (rows.length === 0) doc.fillColor("#666").text("No events in this period.").fillColor("#000");
        for (const [label, count] of rows) doc.text(`${label}: ${count}`);
        doc.moveDown(0.7);
      }
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function renderAnalyticsExcel(analytics, period) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Smart Cemetery";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Metric", key: "metric", width: 28 },
    { header: "Value", key: "value", width: 18 },
  ];
  summary.addRow({ metric: "Period", value: periodLabel(period) });
  summary.addRow({ metric: "Audit actions", value: analytics.totals.auditActions });
  summary.addRow({ metric: "Navigation events", value: analytics.totals.navigations });

  const sheets = [
    ["Audit Actions", "Action", analytics.auditActions, "action"],
    ["Navigation Daily", "Date", analytics.navigation.daily, "date"],
    ["Navigation Channels", "Channel", analytics.navigation.channels, "channel"],
    ["Destinations", "Plot group", analytics.navigation.destinations, "destination"],
  ];
  for (const [name, label, rows, key] of sheets) {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = [
      { header: label, key: "label", width: 42 },
      { header: "Count", key: "count", width: 14 },
    ];
    for (const row of rows) sheet.addRow({ label: row[key], count: row.count });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}