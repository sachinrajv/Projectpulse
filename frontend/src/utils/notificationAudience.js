// notificationAudience.js — decides whether an Audit Log row is a notification
// FOR the signed-in user (Sep 29, Defect 1: "user-specific notifications").
//
// Frontend only — no flow / SQL change. It re-uses the audience rules the app
// already has for its e-mail notifications (constants/Notifications.js,
// FSD 4.5): each event names who it concerns — the project's PM, Delivery
// Head, the resource, Finance, Management. The audit row only stores
// screen / action / record text / actor, so the project or person it is about
// is found by matching that record text against the project, billing and user
// lists.
//
//   Admin                      -> sees every row.
//   Event with an audience     -> shown only if this user is in it:
//        finance / management  = holds that role
//        pm / deliveryHead     = is that project's PM / Delivery Head
//        resource              = is the employee named in the record
//        manager               = is that employee's reporting manager
//   Master-data screens (no e-mail event) -> unchanged: shown when the user can open the screen.
import { resolveEvent } from "../constants/Notifications";

const norm = (s) => String(s || "").trim().toLowerCase();
const same = (a, b) => a != null && b != null && a !== "" && b !== "" && String(a) === String(b);

export function fullName(u) {
  return `${u?.firstName || ""} ${u?.lastName || ""}`.trim();
}

function userHasRole(dir, userId, pattern) {
  const roleIds = new Set(
    (dir.roles || []).filter((r) => pattern.test(r.name || r.code || "")).map((r) => String(r.guid ?? r.id))
  );
  return (dir.userRoles || []).some((ur) => same(ur.userId, userId) && roleIds.has(String(ur.roleId)));
}

// Projects an audit record talks about (record text contains the project name,
// or the billing milestone belongs to the project).
function projectsInRecord(record, projects, billings) {
  const rec = norm(record);
  if (!rec) return [];
  const found = new Map();
  (projects || []).forEach((p) => {
    const n = norm(p.projectName);
    if (n && rec.includes(n)) found.set(String(p.guid), p);
  });
  (billings || []).forEach((b) => {
    const m = norm(b.milestoneName);
    if (m && rec === m) {
      const p = (projects || []).find((x) => same(x.guid, b.projectId));
      if (p) found.set(String(p.guid), p);
    }
  });
  return [...found.values()];
}

// The employee the record names ("Ravi Kumar → Project X", "Ravi Kumar — week of …").
function usersInRecord(record, users) {
  const rec = norm(record);
  return (users || []).filter((u) => {
    const n = norm(fullName(u));
    return n && rec.includes(n);
  });
}

const FINANCE = /finance/i;
const MANAGEMENT = /management|director|leadership/i;

// ctx = { dir, projects, billings }  (dir = utils/userDirectory.js directory)
// Returns true / false. Rows without an e-mail event return null ("no
// audience rule") so the caller can fall back to the screen permission.
export function audienceMatch(row, userId, ctx) {
  const ev = resolveEvent(row.screen, row.action, {});
  if (!ev) return null;

  const buckets = [...[].concat(ev.to || []), ...[].concat(ev.cc || [])];
  // A Billing update may be an approval / rejection, which goes to the PM —
  // the audit row doesn't keep the status, so include the PM for every update.
  if (row.screen === "Billing" && row.action === "Update") buckets.push("pm");
  const { dir } = ctx;

  if (buckets.includes("finance") && userHasRole(dir, userId, FINANCE)) return true;
  if (buckets.includes("management") && userHasRole(dir, userId, MANAGEMENT)) return true;

  if (buckets.includes("pm") || buckets.includes("deliveryHead")) {
    const projs = projectsInRecord(row.record, ctx.projects, ctx.billings);
    if (buckets.includes("pm") && projs.some((p) => same(p.projectManagerUserId, userId))) return true;
    if (buckets.includes("deliveryHead") && projs.some((p) => same(p.deliveryHeadUserId, userId))) return true;
  }

  if (buckets.includes("resource") || buckets.includes("manager")) {
    const people = usersInRecord(row.record, dir.users);
    if (buckets.includes("resource") && people.some((u) => same(u.guid ?? u.id, userId))) return true;
    if (buckets.includes("manager") && people.some((u) => same(u.reportingManagerId, userId))) return true;
  }
  return false;
}
