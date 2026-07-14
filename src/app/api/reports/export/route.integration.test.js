import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";

// ── Mocked collaborators ────────────────────────────────────────────────────
// Prisma is fully mocked: the handler only calls findMany on four models and
// we feed it the rows each test needs. Authorization is mocked so we can drive
// the ok / not-ok branches directly. computeReport AND the PDF/Excel renderers
// are kept REAL (they run under Node vitest via pdfkit/exceljs) so the tests
// exercise genuine document generation and assert on real file bytes. The
// export module is wrapped: renderPdf/renderExcel default to the real
// implementation, and a single test overrides one of them to throw so we can
// verify the generation-failure path (Req 10.6) without a partial document.
vi.mock("@/lib/db", () => ({
  prisma: {
    grave: { findMany: vi.fn() },
    plot: { findMany: vi.fn() },
    request: { findMany: vi.fn() },
    feedback: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/authz", () => ({ requireRole: vi.fn() }));

vi.mock("@/lib/reporting/export", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    // Delegate to the real renderers by default; individual tests may override
    // with mockImplementationOnce to simulate a generation failure.
    renderPdf: vi.fn((model) => actual.renderPdf(model)),
    renderExcel: vi.fn((model) => actual.renderExcel(model)),
  };
});

import { GET } from "@/app/api/reports/export/route";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import { renderPdf, renderExcel } from "@/lib/reporting/export";

/** Build a real GET Request for the export endpoint with query params. */
function makeRequest(query = "") {
  const suffix = query ? `?${query}` : "";
  return new Request(`http://localhost/api/reports/export${suffix}`);
}

/** Authorize the caller as an Admin (requireRole resolves ok). */
function authorizeAdmin() {
  requireRole.mockResolvedValueOnce({ ok: true, user: { id: 1, role: "Admin" } });
}

/** Point every prisma.*.findMany at the given rows for one call. */
function stubDatasets({ graves = [], plots = [], requests = [], feedback = [] } = {}) {
  prisma.grave.findMany.mockResolvedValueOnce(graves);
  prisma.plot.findMany.mockResolvedValueOnce(plots);
  prisma.request.findMany.mockResolvedValueOnce(requests);
  prisma.feedback.findMany.mockResolvedValueOnce(feedback);
}

/** A small non-empty dataset so the report has real (non-zero) figures. */
const POPULATED = {
  graves: [
    { status: "active", burialDate: "2024-01-10", createdAt: "2024-01-10" },
    { status: "archived", burialDate: "2024-01-12", createdAt: "2024-01-12" },
  ],
  plots: [
    { status: "occupied", createdAt: "2024-01-05" },
    { status: "available", createdAt: "2024-01-06" },
  ],
  requests: [
    { status: "pending", createdAt: "2024-01-07" },
    { status: "approved", createdAt: "2024-01-08" },
  ],
  feedback: [
    { rating: 5, createdAt: "2024-01-09" },
    { rating: 4, createdAt: "2024-01-11" },
  ],
};

const PERIOD_QS = "from=2024-01-01&to=2024-01-31";

describe("GET /api/reports/export integration", () => {
  beforeEach(() => {
    // clearAllMocks resets call history but preserves the delegating renderer
    // implementations set up in the module factory above.
    vi.clearAllMocks();
  });

  it("streams a valid PDF download when an Admin requests format=pdf (Req 10.1)", async () => {
    authorizeAdmin();
    stubDatasets(POPULATED);

    const res = await GET(makeRequest(`format=pdf&${PERIOD_QS}`));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toMatch(/^attachment;/);
    expect(disposition).toMatch(/filename="[^"]+\.pdf"/);

    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
    // A well-formed PDF begins with the "%PDF" magic marker.
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");

    expect(renderPdf).toHaveBeenCalledTimes(1);
    expect(renderExcel).not.toHaveBeenCalled();
  });

  it("streams a valid XLSX download when an Admin requests format=excel (Req 10.2)", async () => {
    authorizeAdmin();
    stubDatasets(POPULATED);

    const res = await GET(makeRequest(`format=excel&${PERIOD_QS}`));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const disposition = res.headers.get("Content-Disposition");
    expect(disposition).toMatch(/^attachment;/);
    expect(disposition).toMatch(/filename="[^"]+\.xlsx"/);

    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
    // XLSX is a ZIP container: the first two bytes are the "PK" local-file magic.
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'

    expect(renderExcel).toHaveBeenCalledTimes(1);
    expect(renderPdf).not.toHaveBeenCalled();
  });

  it("returns 403 and generates no document for a non-admin caller (Req 10.4)", async () => {
    const forbidden = new Response(
      JSON.stringify({ error: { type: "forbidden", message: "Insufficient role permission" } }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
    requireRole.mockResolvedValueOnce({ ok: false, response: forbidden });

    const res = await GET(makeRequest(`format=pdf&${PERIOD_QS}`));

    expect(res.status).toBe(403);
    expect(res.headers.get("Content-Type")).not.toBe("application/pdf");

    // No data fetched, no document rendered.
    expect(prisma.grave.findMany).not.toHaveBeenCalled();
    expect(prisma.plot.findMany).not.toHaveBeenCalled();
    expect(prisma.request.findMany).not.toHaveBeenCalled();
    expect(prisma.feedback.findMany).not.toHaveBeenCalled();
    expect(renderPdf).not.toHaveBeenCalled();
    expect(renderExcel).not.toHaveBeenCalled();
  });

  it("still produces a zero-value document with a 'no records' note for an empty period (Req 10.5)", async () => {
    authorizeAdmin();
    stubDatasets({ graves: [], plots: [], requests: [], feedback: [] });

    const res = await GET(makeRequest(`format=excel&${PERIOD_QS}`));

    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);

    // Read the workbook back and confirm the empty-period note is present and
    // the headline totals are all zero.
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.worksheets[0];
    const cells = [];
    sheet.eachRow((row) => {
      row.eachCell((cell) => cells.push(String(cell.value)));
    });
    expect(cells.some((v) => v.includes("No records for the selected period"))).toBe(true);
  });

  it("returns 400 with a validation error and no document for an invalid format (Req 10.1/10.2)", async () => {
    authorizeAdmin();

    const res = await GET(makeRequest(`format=xml&${PERIOD_QS}`));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.type).toBe("validation");

    // Rejected before any data fetch or rendering.
    expect(prisma.grave.findMany).not.toHaveBeenCalled();
    expect(renderPdf).not.toHaveBeenCalled();
    expect(renderExcel).not.toHaveBeenCalled();
  });

  it("returns 500 export-failure and no partial binary document when generation throws (Req 10.6)", async () => {
    authorizeAdmin();
    stubDatasets(POPULATED);
    renderPdf.mockImplementationOnce(() =>
      Promise.reject(new Error("pdf generation blew up"))
    );

    const res = await GET(makeRequest(`format=pdf&${PERIOD_QS}`));

    expect(res.status).toBe(500);
    // The response is a JSON error, NOT a binary document.
    expect(res.headers.get("Content-Type")).not.toBe("application/pdf");
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.type).toBe("export_failed");

    expect(renderPdf).toHaveBeenCalledTimes(1);
  });
});
