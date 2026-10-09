// Compares every entity in the API against the exported Power Automate flow definitions
// (scripts/flow-spec.json): same table, same columns written on create and on edit,
// same response keys / source columns. Run: npm run verify:flows
import fs from "node:fs";
import { registry } from "../src/entities/index.js";

const spec = JSON.parse(fs.readFileSync(new URL("./flow-spec.json", import.meta.url), "utf8"));
const SKIP = new Set(["Auth", "Permission"]); // custom actions, covered by their own tests
const dec = (c) => String(c).replace(/_x0020_/g, " ");
const bare = (t) => String(t || "").replace(/\[dbo\]\.|\[|\]/g, "");

// Known, deliberate differences from the flows (each explained).
const KNOWN = {
  "ProjectResourceTxn.EDIT": "the flow writes EndDate as 'end' + date (a typo that makes every edit fail); the API writes the date",
  "AuditLog.CREATE-return": "the flow re-reads the whole log on every insert; the API answers [] (the app ignores it)",
};

const KNOWN_SELECT = {
  "Invoice.active": "the flow sent IsActive as 'True'/'False' text, which the app reads as always-true; the API sends a real boolean",
  "ProjectApproval.active": "the flow sent IsActive as 'True'/'False' text, which the app reads as always-true; the API sends a real boolean",
};

let problems = 0, ok = 0, missing = [];
const note = (entity, msg) => { problems++; console.log(`  ✗ ${entity}: ${msg}`); };

for (const [entity, flow] of Object.entries(spec)) {
  if (SKIP.has(entity)) continue;
  const h = registry[entity];
  if (!h) { missing.push(entity); continue; }
  const start = problems;

  // Custom handlers without a generic config (e.g. ProjectDocumentFile) are verified by their own tests.
  const cfg = h._cfg;
  if (!cfg) { console.log(`  · ${entity}: custom handler (verified by tests)`); continue; }

  if (flow.table && bare(flow.table) !== cfg.table) note(entity, `table is ${cfg.table}, flow uses ${bare(flow.table)}`);

  const mineCreate = {};
  cfg.fields.filter((f) => f.create !== false).forEach((f) => (mineCreate[f.col] = f.const !== undefined ? "?" + f.const : f.in));
  if (cfg.createdOn) mineCreate[cfg.createdOn] = "@utcNow";
  if (cfg.modifiedOn && cfg.modifiedOnInsert) mineCreate[cfg.modifiedOn] = "@utcNow";
  if (cfg.guidCol) mineCreate[cfg.guidCol] = "@guid";

  const mineEdit = {};
  cfg.fields.filter((f) => f.edit !== false).forEach((f) => (mineEdit[f.col] = f.const !== undefined ? "?" + f.const : f.in));
  if (cfg.modifiedOn) mineEdit[cfg.modifiedOn] = "@utcNow";

  const diff = (label, flowItemRaw, mine) => {
    const flowItem = flowItemRaw && Object.fromEntries(Object.entries(flowItemRaw).map(([k, v]) => [dec(k), v]));
    const known = KNOWN[`${entity}.${label}`];
    const keys = new Set([...Object.keys(flowItem || {}), ...Object.keys(mine)]);
    for (const k of keys) {
      const a = flowItem?.[k], b = mine[k];
      if (a === b) continue;
      if (known) { console.log(`  ~ ${entity}.${label} ${k}: ${known}`); continue; }
      note(entity, `${label} ${k}: flow=${a ?? "(not written)"} api=${b ?? "(not written)"}`);
    }
  };
  if (flow.CREATE) diff("CREATE", flow.CREATE.item, mineCreate);
  if (flow.EDIT) diff("EDIT", flow.EDIT.item, mineEdit);
  if (!flow.CREATE && h.CREATE) note(entity, "API allows CREATE but the flow has none");
  if (!flow.EDIT && h.EDIT) note(entity, "API allows EDIT but the flow has none");
  if (!flow.DELETE && h.DELETE) note(entity, "API allows DELETE but the flow has none");
  if (flow.DELETE && !h.DELETE) note(entity, "flow has DELETE but the API does not");

  // response shape
  if (flow.select) {
    const mine = Object.fromEntries(Object.entries(cfg.select).map(([k, v]) => [k, typeof v === "object" ? v : { col: v, expr: "" }]));
    for (const [k, [colRaw, txt]] of Object.entries(flow.select)) {
      const col = dec(colRaw);
      const m = mine[k];
      if (!m) { note(entity, `response key '${k}' missing`); continue; }
      if (m.col !== col) note(entity, `response '${k}' reads ${m.col}, flow reads ${col}`);
      const mineTxt = /ISNULL\(/.test(m.expr) && !/CONVERT\(varchar\(10\)/.test(m.expr) ? true : /ISNULL\(/.test(m.expr);
      if (!!txt !== mineTxt && !KNOWN_SELECT[`${entity}.${k}`]) note(entity, `response '${k}' ${txt ? "should" : "should not"} be text-with-blank-for-null (flow's @{...})`);
    }
    for (const k of Object.keys(mine)) if (!(k in flow.select)) note(entity, `extra response key '${k}' (flow has no such key)`);
    if (flow.select.guid && cfg.pk !== dec(flow.select.guid[0])) note(entity, `primary key ${cfg.pk} but flow's guid reads ${dec(flow.select.guid[0])}`);
  }
  if (problems === start) ok++;
}

console.log(`\n${ok} entities match the flows exactly.`);
if (missing.length) console.log(`Not built yet (${missing.length}): ${missing.join(", ")}`);
if (problems) { console.log(`${problems} difference(s) found.`); process.exit(1); }
