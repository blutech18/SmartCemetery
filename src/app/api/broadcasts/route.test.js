import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/authz", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/broadcasts", () => ({ createAndDeliverBroadcast: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn(), getClientIp: vi.fn(() => "") }));

import { POST } from "@/app/api/broadcasts/route";
import { requireRole } from "@/lib/authz";
import { createAndDeliverBroadcast } from "@/lib/broadcasts";
import { writeAuditLog } from "@/lib/audit";

function request(body) {
  return new Request("http://localhost/api/broadcasts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/broadcasts", () => {
  it("returns the Admin guard rejection before delivery", async () => {
    const forbidden = new Response("forbidden", { status: 403 });
    requireRole.mockResolvedValue({ ok: false, response: forbidden });
    const response = await POST(request({ audience: "All", title: "Notice", message: "Hello" }));
    expect(response).toBe(forbidden);
    expect(createAndDeliverBroadcast).not.toHaveBeenCalled();
  });

  it("delivers a valid Admin broadcast and audits the summary", async () => {
    requireRole.mockResolvedValue({ ok: true, user: { id: "1", role: "Admin" } });
    createAndDeliverBroadcast.mockResolvedValue({
      id: 12, audience: "Client", title: "Notice", status: "sent",
      recipients: 4, deliveries: { sent: 4, failed: 0, skipped: 0 },
    });
    const response = await POST(request({ audience: "Client", title: "Notice", message: "Hello clients" }));
    expect(response.status).toBe(201);
    expect(createAndDeliverBroadcast).toHaveBeenCalledWith(expect.objectContaining({ creatorId: 1, audience: "Client" }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: expect.stringContaining("recipients=4") }));
  });
});
