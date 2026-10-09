/**
 * Extra project fields that have no column in the Project table / flow yet:
 * Actual Start Date, Actual End Date (Defect 8) and the On Hold reason
 * (Defect 2, Sep 29). The flow can't be changed from the front end, so they
 * are carried inside the existing `remarks` text as a small hidden tag at the
 * very end:
 *
 *     <user remarks>\n[[PP:AS=2026-01-05|AE=2026-06-30|HR=<url-encoded reason>]]
 *
 * flows.js (callProjectFlow) encodes on save and decodes on load, so every
 * screen only ever sees clean `remarks` plus `actualStartDate`,
 * `actualEndDate` and `holdReason`.
 *
 * When real columns are added to the Project table and flow, only
 * callProjectFlow needs to change (send/read the fields directly) — no
 * screen has to be touched.
 */
const TAG_RE = /\s*\[\[PP:([^\]]*)\]\]\s*$/;

export function decodeActualDates(rawRemarks) {
  const raw = rawRemarks == null ? "" : String(rawRemarks);
  const m = raw.match(TAG_RE);
  if (!m) return { remarks: raw, actualStartDate: "", actualEndDate: "", holdReason: "" };
  const parts = {};
  m[1].split("|").forEach((kv) => {
    const i = kv.indexOf("=");
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  });
  let holdReason = "";
  try { holdReason = parts.HR ? decodeURIComponent(parts.HR) : ""; } catch { holdReason = parts.HR || ""; }
  return {
    remarks: raw.slice(0, m.index),
    actualStartDate: parts.AS || "",
    actualEndDate: parts.AE || "",
    holdReason,
  };
}

export function encodeActualDates(remarks, actualStartDate, actualEndDate, holdReason) {
  const clean = decodeActualDates(remarks).remarks; // never double-tag
  const as = actualStartDate ? String(actualStartDate).slice(0, 10) : "";
  const ae = actualEndDate ? String(actualEndDate).slice(0, 10) : "";
  const hr = holdReason ? encodeURIComponent(String(holdReason).trim()) : "";
  if (!as && !ae && !hr) return clean;
  return `${clean}\n[[PP:AS=${as}|AE=${ae}${hr ? `|HR=${hr}` : ""}]]`;
}