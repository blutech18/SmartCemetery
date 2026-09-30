import { describe, it, expect, afterEach } from "vitest";
import { detectImageType, normalizePhotoUrl } from "@/lib/photo-upload";
import { getClientIp } from "@/lib/audit";

const pad = (arr) => Buffer.concat([Buffer.from(arr), Buffer.alloc(16)]);

describe("detectImageType", () => {
  it("identifies real images by magic bytes", () => {
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe("png");
    expect(detectImageType(Buffer.from("GIF89a" + "\0".repeat(10)))?.ext).toBe("gif");
    expect(detectImageType(Buffer.from("RIFF\0\0\0\0WEBP\0\0\0\0"))?.ext).toBe("webp");
  });
  it("rejects non-images regardless of claimed type", () => {
    expect(detectImageType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(Buffer.alloc(4))).toBeNull();
  });
});

describe("normalizePhotoUrl", () => {
  it("clears on empty/reset/null", () => {
    for (const v of [null, undefined, "", "  ", "reset"]) {
      expect(normalizePhotoUrl(v)).toEqual({ ok: true, value: null });
    }
  });
  it("accepts http(s) URLs and site paths", () => {
    expect(normalizePhotoUrl("https://example.com/a.jpg").ok).toBe(true);
    expect(normalizePhotoUrl("/uploads/graves/x.png").ok).toBe(true);
  });
  it("rejects dangerous or malformed values", () => {
    for (const v of ["javascript:alert(1)", "data:text/html,x", "//evil.com/x", "/a" + String.fromCharCode(92) + "b", "ftp://x", 5, "x".repeat(3000)]) {
      expect(normalizePhotoUrl(v).ok).toBe(false);
    }
  });
});

describe("getClientIp with TRUSTED_PROXY_COUNT", () => {
  const req = { headers: { "x-forwarded-for": "6.6.6.6, 1.1.1.1, 2.2.2.2" } };
  afterEach(() => { delete process.env.TRUSTED_PROXY_COUNT; });
  it("defaults to left-most (legacy)", () => {
    expect(getClientIp(req)).toBe("6.6.6.6");
  });
  it("uses the entry appended by the trusted proxy, ignoring spoofed prefix", () => {
    process.env.TRUSTED_PROXY_COUNT = "1";
    expect(getClientIp(req)).toBe("2.2.2.2");
    process.env.TRUSTED_PROXY_COUNT = "2";
    expect(getClientIp(req)).toBe("1.1.1.1");
  });
});
