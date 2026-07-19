import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/routing/route";

const validBody = {
  origin: { lat: 8.4647, lng: 124.6578 },
  destination: { lat: 8.4648, lng: 124.6579 },
};

function post(body) {
  return new Request("http://localhost/api/routing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/routing", () => {
  it("returns a typed 400 for invalid coordinates", async () => {
    const response = await POST(post({ ...validBody, origin: { lat: "8.4", lng: 124.6 } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { type: "INVALID_COORDINATES" } });
  });

  it("returns a typed 400 for malformed JSON", async () => {
    const response = await POST(post("{"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { type: "INVALID_REQUEST" } });
  });

  it("returns a safe 503 when the provider is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const response = await POST(post(validBody));
    const data = await response.json();
    expect(response.status).toBe(503);
    expect(data).toEqual({ error: { type: "ROUTING_UNAVAILABLE", message: "Routing is temporarily unavailable." } });
  });
});