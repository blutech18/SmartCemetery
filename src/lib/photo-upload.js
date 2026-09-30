import path from "node:path";
import { MAX_TIERS } from "./cemetery-layout";
import fs from "node:fs";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PHOTO_URL_LENGTH = 2048;

/**
 * Identify an image by its magic bytes. The client-supplied `File.type` is
 * attacker-controlled, so it is only a hint; the stored extension is derived
 * from the actual content.
 *
 * @param {Buffer} buf
 * @returns {{ ext: string, mime: string } | null}
 */
export function detectImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png" };
  }
  if (buf.toString("ascii", 0, 3) === "GIF" && /^GIF8[79]a$/.test(buf.toString("ascii", 0, 6))) {
    return { ext: "gif", mime: "image/gif" };
  }
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

/**
 * Validate a caller-supplied photo reference. Accepts `null`/"reset"/"" (clear),
 * an absolute http(s) URL, or a same-origin absolute path. Rejects every other
 * scheme (`javascript:`, `data:`, ...) and protocol-relative `//host` paths.
 *
 * @param {unknown} value
 * @returns {{ ok: true, value: string | null } | { ok: false, error: string }}
 */
export function normalizePhotoUrl(value) {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "photoUrl must be a string" };

  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "reset") return { ok: true, value: null };
  if (trimmed.length > MAX_PHOTO_URL_LENGTH) return { ok: false, error: "photoUrl is too long" };

  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//") || trimmed.includes("\\")) {
      return { ok: false, error: "photoUrl must be an http(s) URL or a site path" };
    }
    return { ok: true, value: trimmed };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return { ok: true, value: trimmed };
    }
  } catch {
    // fall through
  }
  return { ok: false, error: "photoUrl must be an http(s) URL or a site path" };
}

/**
 * Validate and persist an uploaded image under public/uploads/graves.
 *
 * @param {File} file multipart file entry
 * @param {string} prefix filename prefix, e.g. `grave-12`
 * @returns {Promise<{ ok: true, url: string } | { ok: false, error: string }>}
 */
export async function saveUploadedImage(file, prefix) {
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "File exceeds 5MB size limit." };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_PHOTO_BYTES) {
    return { ok: false, error: "File exceeds 5MB size limit." };
  }
  const detected = detectImageType(buffer);
  if (!detected) {
    return {
      ok: false,
      error: "Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.",
    };
  }

  const filename = `${prefix}-${Date.now()}.${detected.ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "graves");
  await fs.promises.mkdir(uploadDir, { recursive: true });
  await fs.promises.writeFile(path.join(uploadDir, filename), buffer);
  return { ok: true, url: `/uploads/graves/${filename}` };
}

/**
 * Parse a photo POST (multipart upload or JSON `{ photoUrl }`) into a validated
 * change. Saves an uploaded file as a side effect. Shared by the grave and plot
 * photo routes.
 *
 * @param {Request} request
 * @param {string} prefix filename prefix for uploads, e.g. `plot-12`
 * @returns {Promise<{ ok: true, photoUrl: string|null, tier: number|null, applyToAll: boolean }
 *   | { ok: false, status: number, error: string }>}
 */
export async function parsePhotoRequest(request, prefix) {
  const contentType = request.headers.get("content-type") || "";
  let rawPhotoUrl = null;
  let rawTier = null;
  let applyToAll = false;

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const file = formData.get("file");
      rawTier = formData.get("tier");
      applyToAll = formData.get("applyToAll") === "true";
      rawPhotoUrl = formData.get("photoUrl") || null;

      if (file && typeof file === "object" && typeof file.arrayBuffer === "function") {
        const saved = await saveUploadedImage(file, prefix);
        if (!saved.ok) return { ok: false, status: 400, error: saved.error };
        rawPhotoUrl = saved.url;
      }
    } catch (err) {
      console.error("Failed to parse form data:", err);
      return { ok: false, status: 400, error: "Failed to upload image file" };
    }
  } else {
    try {
      const body = await request.json();
      rawPhotoUrl = body.photoUrl || null;
      rawTier = body.tier ?? null;
      applyToAll = Boolean(body.applyToAll);
    } catch {
      return { ok: false, status: 400, error: "Invalid JSON body" };
    }
  }

  const normalized = normalizePhotoUrl(rawPhotoUrl);
  if (!normalized.ok) return { ok: false, status: 400, error: normalized.error };

  let tier = null;
  if (rawTier !== null && rawTier !== undefined && rawTier !== "") {
    tier = Number(rawTier);
    if (!Number.isInteger(tier) || tier < 0 || tier > MAX_TIERS) {
      return { ok: false, status: 400, error: "Invalid tier" };
    }
  }
  return { ok: true, photoUrl: normalized.value, tier, applyToAll };
}
