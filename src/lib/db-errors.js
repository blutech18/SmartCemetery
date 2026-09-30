import { NextResponse } from "next/server";

/**
 * Prisma raises P2021 (table missing) / P2022 (column missing) when the code is
 * newer than the database, i.e. a migration has not been applied.
 */
export function isSchemaOutOfDate(error) {
  return error?.code === "P2021" || error?.code === "P2022";
}

/**
 * If `error` means "the database schema is behind", log how to fix it and
 * return a 503 response an operator can act on; otherwise return null so the
 * caller handles the error as usual.
 */
export function schemaOutOfDateResponse(error, context = "request") {
  if (!isSchemaOutOfDate(error)) return null;
  console.error(
    `[db] ${context}: the database schema is out of date (${error.code}${
      error.meta?.column ? `, column ${error.meta.column}` : ""
    }${error.meta?.table ? `, table ${error.meta.table}` : ""}). Run \`npm run db:migrate\`.`
  );
  return NextResponse.json(
    {
      error: {
        type: "schema_out_of_date",
        message: "The database schema is out of date. An administrator must run `npm run db:migrate`.",
      },
    },
    { status: 503 }
  );
}
