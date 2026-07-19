/**
 * Duplicate Detection Module
 * Prevents double-booking of plots and duplicate grave entries
 *
 * DB-backed functions receive the Prisma client via dependency injection so
 * this module can be imported (e.g. for testing the pure helpers) without a
 * database connection. See `smartSearch` in `search.js` for the same pattern.
 */

import { NextResponse } from "next/server";

/**
 * Check if a plot is already occupied or reserved
 */
export async function checkPlotAvailability(prisma, plotId) {
  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: { graves: true },
  });

  if (!plot) {
    return { available: false, reason: "Plot not found" };
  }

  if (plot.status === "occupied") {
    return { available: false, reason: "Plot is already occupied" };
  }

  if (plot.status === "reserved") {
    return { available: false, reason: "Plot is already reserved" };
  }

  if (plot.status === "maintenance") {
    return { available: false, reason: "Plot is under maintenance" };
  }

  return { available: true, reason: null };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Normalize a deceased name for comparison: coerce to string, trim leading and
 * trailing whitespace, then case-fold (lower-case). Non-string / missing values
 * become an empty string.
 */
function normalizeName(name) {
  return String(name ?? "").trim().toLowerCase();
}

/**
 * Convert a value to a UTC calendar-day number (whole days since the epoch),
 * ignoring the time-of-day component. Returns `null` when the value is missing
 * or cannot be parsed into a valid date.
 */
function toCalendarDayNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) {
    return null;
  }

  // Use UTC components so the "calendar day" is timezone-independent and stable
  // for property testing.
  const utcMidnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
  return Math.floor(utcMidnight / MS_PER_DAY);
}

/**
 * Pure duplicate predicate (property-testable, Req 4.1).
 *
 * Returns true if and only if:
 *   1. the two deceased names are equal after trimming and case-folding, AND
 *   2. the two burial dates fall within one calendar day (inclusive) of each
 *      other — i.e. the same day, or one calendar day before/after.
 *
 * Each argument is an object shaped like `{ deceasedName, burialDate }`.
 *
 * Missing/null/invalid burial date handling: if either `burialDate` is missing,
 * null, or unparseable, the calendar-day window cannot be satisfied and the
 * function returns `false` (a candidate without a comparable burial date is not
 * treated as a duplicate).
 *
 * @param {{ deceasedName?: unknown, burialDate?: unknown }} candidate
 * @param {{ deceasedName?: unknown, burialDate?: unknown }} existing
 * @returns {boolean}
 */
export function isPotentialDuplicate(candidate, existing) {
  const a = candidate || {};
  const b = existing || {};

  if (normalizeName(a.deceasedName) !== normalizeName(b.deceasedName)) {
    return false;
  }

  const dayA = toCalendarDayNumber(a.burialDate);
  const dayB = toCalendarDayNumber(b.burialDate);

  if (dayA === null || dayB === null) {
    return false;
  }

  return Math.abs(dayA - dayB) <= 1;
}

/**
 * Check for duplicate grave records (same name + similar burial date).
 *
 * Thin DB wrapper around the pure {@link isPotentialDuplicate} predicate:
 * the database query only *narrows* candidates (case-insensitive name match and
 * a slightly widened burial-date window), while the final match decision is made
 * by the pure predicate so the trim + case-fold + ±1-calendar-day-inclusive
 * semantics always hold.
 *
 * `prisma` is dependency-injected as the first parameter (no top-level Prisma
 * import) so the module stays importable without a database connection.
 */
export async function checkDuplicateGrave(prisma, deceasedName, burialDate, excludeId = null) {
  const candidate = { deceasedName, burialDate };

  // Without a comparable burial date the pure predicate can never match, so
  // there is no need to query the database.
  if (toCalendarDayNumber(burialDate) === null) {
    return { hasDuplicate: false, duplicates: [] };
  }

  const where = {
    // Case-insensitive under MySQL's default collation; the exact trim +
    // case-fold decision is enforced by the pure predicate below.
    deceasedName: { equals: String(deceasedName ?? "").trim() },
  };

  // Widen the DB window by an extra day on each side so time-of-day boundaries
  // never exclude a row that the calendar-day predicate would accept. The pure
  // predicate then applies the exact ±1 calendar-day window.
  const date = new Date(burialDate);
  const windowStart = new Date(date);
  windowStart.setUTCDate(windowStart.getUTCDate() - 2);
  const windowEnd = new Date(date);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 2);
  where.burialDate = { gte: windowStart, lte: windowEnd };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  const candidates = await prisma.grave.findMany({
    where,
    include: {
      plot: {
        include: {
          locationDetail: {
            include: { location: true },
          },
        },
      },
    },
  });

  // Final decision reflects the pure predicate's semantics exactly.
  const duplicates = candidates.filter((existing) =>
    isPotentialDuplicate(candidate, {
      deceasedName: existing.deceasedName,
      burialDate: existing.burialDate,
    })
  );

  return {
    hasDuplicate: duplicates.length > 0,
    duplicates,
  };
}

/**
 * Validate record completeness — alert if critical fields are missing (Req 5.1).
 *
 * A critical field is missing when:
 *   - deceasedName is null/undefined or contains only whitespace,
 *   - burialDate is null/undefined,
 *   - plotId is null/undefined,
 *   - plotGps is absent or either coordinate is null/undefined.
 *
 * Returns both an explicit `missing` list using the canonical field names
 * ("deceasedName" | "burialDate" | "plotId" | "plotGps") consumed by the
 * incomplete-record alert endpoint and property tests, and the human-readable
 * `issues` list kept for backward compatibility. Pure function (no I/O).
 *
 * @param {{ deceasedName?: unknown, burialDate?: unknown, plotId?: unknown, plotGps?: { lat?: unknown, lng?: unknown } | null }} graveData
 * @returns {{ isComplete: boolean, missing: string[], issues: string[] }}
 */
export function validateRecordCompleteness(graveData) {
  const data = graveData || {};
  const missing = [];
  const issues = [];

  if (typeof data.deceasedName !== "string" || data.deceasedName.trim() === "") {
    missing.push("deceasedName");
    issues.push("Missing deceased name");
  }

  if (data.burialDate === null || data.burialDate === undefined) {
    missing.push("burialDate");
    issues.push("Missing burial date");
  }

  if (data.plotId === null || data.plotId === undefined) {
    missing.push("plotId");
    issues.push("Missing plot assignment");
  }

  const plotGps = data.plotGps;
  if (
    !plotGps ||
    plotGps.lat === null || plotGps.lat === undefined ||
    plotGps.lng === null || plotGps.lng === undefined
  ) {
    missing.push("plotGps");
    issues.push("Missing plot GPS coordinates");
  }

  return {
    isComplete: missing.length === 0,
    missing,
    issues,
  };
}

/**
 * Uniform validation layer (Requirement 15)
 *
 * A small declarative schema describes each field. `validateBody` checks every
 * field in one pass — it never stops at the first failure — and returns either
 * the coerced value or the complete list of failing fields. `validationErrorResponse`
 * turns that list into the single uniform 400 response shape used across all
 * mutating endpoints (consistent with the authz guard).
 *
 * Schema format (per field):
 *   {
 *     required: boolean,          // field must be present and non-empty
 *     type: "string" | "number" | "integer" | "boolean",
 *     enum: [allowed, values],    // value must be one of these
 *     min: number,                // number: min value; string: min length (after trim)
 *     max: number,                // number: max value; string: max length (after trim)
 *     trim: boolean,              // trim string before checks; trimmed value is returned
 *   }
 *
 * Both functions are pure (no I/O, no DB), so they are property-testable.
 */

const ERROR_MESSAGES = {
  required: (field) => `${field} is required`,
  type: (field, expected) => `${field} must be of type ${expected}`,
  enum: (field, allowed) => `${field} must be one of: ${allowed.join(", ")}`,
  min: (field, min, isString) =>
    isString
      ? `${field} must be at least ${min} character(s)`
      : `${field} must be at least ${min}`,
  max: (field, max, isString) =>
    isString
      ? `${field} must be at most ${max} character(s)`
      : `${field} must be at most ${max}`,
};

function isEmpty(value) {
  return value === undefined || value === null || value === "";
}

/**
 * Validate a request body against a declarative schema.
 *
 * Collects ALL failing fields in one pass (Req 15.3). Supports required/empty
 * checks (Req 15.1) and type/format/range checks (Req 15.2). Pure function.
 *
 * @param {Record<string, unknown>} body - the parsed request body
 * @param {Record<string, object>} schema - per-field validation rules
 * @returns {{ valid: true, value: object } | { valid: false, errors: Array<{ field: string, code: string, message: string }> }}
 */
export function validateBody(body, schema) {
  const errors = [];
  const value = {};
  const source = body && typeof body === "object" ? body : {};

  for (const field of Object.keys(schema || {})) {
    const rules = schema[field] || {};
    let fieldValue = source[field];

    // Trim strings first so required/length checks see the trimmed value.
    if (rules.trim && typeof fieldValue === "string") {
      fieldValue = fieldValue.trim();
    }

    // Required / empty check (Req 15.1).
    if (isEmpty(fieldValue)) {
      if (rules.required) {
        errors.push({
          field,
          code: "required",
          message: ERROR_MESSAGES.required(field),
        });
      }
      // Nothing more to validate for an absent optional field.
      continue;
    }

    // Type check (Req 15.2).
    if (rules.type && !matchesType(fieldValue, rules.type)) {
      errors.push({
        field,
        code: "type",
        message: ERROR_MESSAGES.type(field, rules.type),
      });
      // Skip range/enum checks when the type is wrong to avoid noisy duplicates.
      continue;
    }

    // Enum / allowed-values check (Req 15.2).
    if (Array.isArray(rules.enum) && !rules.enum.includes(fieldValue)) {
      errors.push({
        field,
        code: "enum",
        message: ERROR_MESSAGES.enum(field, rules.enum),
      });
      continue;
    }

    // Range / length checks (Req 15.2).
    const isString = typeof fieldValue === "string";
    const measure = isString ? fieldValue.length : fieldValue;

    if (typeof rules.min === "number" && measure < rules.min) {
      errors.push({
        field,
        code: "min",
        message: ERROR_MESSAGES.min(field, rules.min, isString),
      });
    }

    if (typeof rules.max === "number" && measure > rules.max) {
      errors.push({
        field,
        code: "max",
        message: ERROR_MESSAGES.max(field, rules.max, isString),
      });
    }

    value[field] = fieldValue;
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, value };
}

/**
 * Type predicate matching the declarative schema `type` values.
 */
function matchesType(value, type) {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    default:
      // Unknown type declarations are treated as satisfied so an incorrect
      // schema never silently rejects valid data.
      return true;
  }
}

/**
 * Build the uniform validation error response (Req 15.5).
 *
 * Produces a NextResponse with HTTP 400 and the shape:
 *   { error: { type: "validation", message, fields: [{ field, code, message }] } }
 *
 * @param {Array<{ field: string, code: string, message: string }>} errors
 * @returns {NextResponse}
 */
export function validationErrorResponse(errors) {
  const fields = Array.isArray(errors) ? errors : [];
  const message =
    fields.length === 1
      ? "Validation failed for 1 field"
      : `Validation failed for ${fields.length} fields`;

  return NextResponse.json(
    {
      error: {
        type: "validation",
        message,
        fields,
      },
    },
    { status: 400 }
  );
}
