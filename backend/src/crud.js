import { query, sql } from "./db.js";

/* ============================================================
   Generic CRUD engine.

   Each entity is described once (table, primary key, which request
   fields map to which columns, and what the response keys are). The
   engine builds the SQL from that description. The descriptions are
   copied from the Power Automate flows (see scripts/verify-flows.mjs,
   which checks them against the exported flow definitions).

   Contract copied from the flows:
     - LIST / CREATE / EDIT / DELETE all return the FULL refreshed list
       for the entity, in the flow's response shape (the pages do
       setRows(res.data) and the Client page finds a new row in it).
     - The frontend strips null keys before sending, so on EDIT an
       absent field means "clear it" and is written as NULL.
     - "guid" in the request/response is the table's integer PK.
     - Timestamps the flow wrote with utcNow() are written in UTC.

   Safety: column and table names only ever come from the entity
   configs in this codebase, never from the request. Every value goes
   in as a SQL parameter.
   ============================================================ */

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export const q = (name) => `[${String(name).replace(/]/g, "]]")}]`;
const tbl = (cfg) => `[dbo].${q(cfg.table)}`;

const isBlank = (v) => v === null || v === undefined || v === "";

// type name -> SQL parameter type, JS coercion, and (optional) SQL wrapper
const TYPES = {
  str: { sql: () => sql.NVarChar(sql.MAX), coerce: (v) => (v == null ? null : String(v)) },
  int: { sql: () => sql.Int, coerce: (v) => (isBlank(v) ? null : Math.trunc(Number(v))) },
  dec: { sql: () => sql.Decimal(18, 4), coerce: (v) => (isBlank(v) ? null : Number(v)) },
  bool: { sql: () => sql.Bit, coerce: (v) => !!v },
  // ISO strings go in as text and are converted by SQL, which avoids JS
  // time-zone shifts on plain dates.
  date: {
    sql: () => sql.VarChar(40),
    coerce: (v) => (isBlank(v) ? null : String(v).slice(0, 10)),
    wrap: (p) => `CONVERT(date, ${p}, 23)`,
  },
  datetime: {
    sql: () => sql.VarChar(40),
    coerce: (v) => (isBlank(v) ? null : String(v)),
    wrap: (p) => `CONVERT(datetime2, ${p}, 127)`,
  },
  // Files arrive as base64 text (no "data:" prefix) and are stored as varbinary.
  binary: {
    sql: () => sql.VarBinary(sql.MAX),
    coerce: (v) => (isBlank(v) ? null : Buffer.from(String(v), "base64")),
  },
};

/* Select helpers. The flows returned dates and some fields in specific
   shapes and the screens were built against them, so we reproduce them:
     date / dateTxt  "2026-10-02T00:00:00"  (no timezone suffix)
     dt / dtTxt      "2026-10-06T10:12:11.123"
     txt             text, NULL becomes ""            (flow's @{...} fields)
     numTxt          number as text, NULL becomes ""  (flow's @{...} fields)
   Plain columns are returned as-is (numbers stay numbers, bits are booleans). */
const h = (expr, col) => ({ expr, col });
export const sel = {
  date: (c) => h(`CASE WHEN ${q(c)} IS NULL THEN NULL ELSE CONVERT(varchar(10), ${q(c)}, 23) + 'T00:00:00' END`, c),
  dateTxt: (c) => h(`ISNULL(CONVERT(varchar(10), ${q(c)}, 23) + 'T00:00:00', N'')`, c),
  dt: (c) => h(`CONVERT(varchar(33), ${q(c)}, 126)`, c),
  dtTxt: (c) => h(`ISNULL(CONVERT(varchar(33), ${q(c)}, 126), N'')`, c),
  txt: (c) => h(`ISNULL(CAST(${q(c)} AS NVARCHAR(MAX)), N'')`, c),
  numTxt: (c) => h(`ISNULL(FORMAT(${q(c)}, '0.##########', 'en-US'), N'')`, c),
};

/**
 * cfg = {
 *   table, pk,
 *   select: { responseKey: "Column" | sel.xxx("Column") },
 *   fields: [{ in: "requestKey", col: "Column", type, create?: false, edit?: false, const?: value }],
 *   createdOn?, modifiedOn?, modifiedOnInsert?, guidCol?,
 *   actions?: ["LIST","CREATE","EDIT","DELETE"],   // default all four
 *   createReturnsList?: false                        // CREATE answers [] instead of re-reading the table
 * }
 */
export function defineCrud(cfg) {
  const selectList = Object.entries(cfg.select)
    .map(([key, col]) => `${typeof col === "object" ? col.expr : q(col)} AS ${q(key)}`)
    .join(", ");
  const listSql = `SELECT ${selectList} FROM ${tbl(cfg)} ORDER BY ${q(cfg.pk)}`;

  const indexed = cfg.fields.map((f, i) => ({ ...f, p: `p${i}` }));
  const createFields = indexed.filter((f) => f.create !== false);
  const editFields = indexed.filter((f) => f.edit !== false);

  const buildParams = (fields, body) =>
    fields.map((f) => ({
      name: f.p,
      type: TYPES[f.type].sql(),
      // "const" = a value the flow hard-coded (the caller's value, if any, is ignored)
      value: TYPES[f.type].coerce(f.const !== undefined ? f.const : body[f.in]),
    }));
  const expr = (f) => {
    const t = TYPES[f.type];
    return t.wrap ? t.wrap(`@${f.p}`) : `@${f.p}`;
  };

  const insertCols = createFields.map((f) => q(f.col));
  const insertVals = createFields.map(expr);
  if (cfg.createdOn) { insertCols.push(q(cfg.createdOn)); insertVals.push("SYSUTCDATETIME()"); }
  if (cfg.modifiedOn && cfg.modifiedOnInsert) { insertCols.push(q(cfg.modifiedOn)); insertVals.push("SYSUTCDATETIME()"); }
  if (cfg.guidCol) { insertCols.push(q(cfg.guidCol)); insertVals.push("NEWID()"); }
  const insertSql = `INSERT INTO ${tbl(cfg)} (${insertCols.join(", ")}) VALUES (${insertVals.join(", ")})`;

  const setParts = editFields.map((f) => `${q(f.col)} = ${expr(f)}`);
  if (cfg.modifiedOn) setParts.push(`${q(cfg.modifiedOn)} = SYSUTCDATETIME()`);
  const updateSql = `UPDATE ${tbl(cfg)} SET ${setParts.join(", ")} WHERE ${q(cfg.pk)} = @guid`;
  const deleteSql = `DELETE FROM ${tbl(cfg)} WHERE ${q(cfg.pk)} = @guid`;

  const guidParam = (body) => {
    if (isBlank(body.guid)) throw httpError(400, `guid is required for ${body.action} on ${body.entity}`);
    return [{ name: "guid", type: sql.Int, value: Number(body.guid) }];
  };

  const all = {
    LIST: () => query(listSql),
    async CREATE(body) {
      await query(insertSql, buildParams(createFields, body));
      return cfg.createReturnsList === false ? [] : query(listSql);
    },
    async EDIT(body) {
      await query(updateSql, [...buildParams(editFields, body), ...guidParam(body)]);
      return query(listSql);
    },
    async DELETE(body) {
      await query(deleteSql, guidParam(body));
      return query(listSql);
    },
  };

  const handler = {};
  for (const a of cfg.actions || Object.keys(all)) handler[a] = all[a];
  // exposed for tests and the flow-verification script (not reachable as actions: they are not functions)
  Object.defineProperty(handler, "_cfg", { value: cfg, enumerable: false });
  Object.defineProperty(handler, "_sql", { value: { listSql, insertSql, updateSql, deleteSql }, enumerable: false });
  return handler;
}
