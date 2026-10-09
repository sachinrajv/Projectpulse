// statusRules.js — Project Status workflow helpers (Sep 29, Defect 2).
//
// Statuses are matched BY NAME against the Project Status master data
// (case-insensitive). "In Progress" is the status a project moves to after
// Finance approval; if the master has no "In Progress", "Active" is accepted
// in its place so the workflow still works.
const norm = (n) => String(n || "").trim().toLowerCase();

export const KIND_BY_NAME = {
  "draft": "draft",
  "pending finance approval": "pending",
  "in progress": "inProgress",
  "active": "inProgress",
  "on hold": "onHold",
  "completed": "completed",
  "closed": "closed",
  "archived": "archived",
};

export const statusKind = (name) => KIND_BY_NAME[norm(name)] || "other";

export function statusKindOf(statuses, id) {
  const s = (statuses || []).find((x) => String(x.id) === String(id));
  return s ? statusKind(s.name) : "other";
}

// Finds the master row for a workflow step (inProgress falls back to Active).
export function findStatusByKind(statuses, kind) {
  const list = statuses || [];
  const exact = { draft: "draft", pending: "pending finance approval", inProgress: "in progress", onHold: "on hold", completed: "completed" }[kind];
  return list.find((s) => norm(s.name) === exact) || (kind === "inProgress" ? list.find((s) => norm(s.name) === "active") : undefined);
}

// Statuses the user can pick while editing a project: In Progress, On Hold, Completed.
export const EDIT_KINDS = ["inProgress", "onHold", "completed"];
// Draft / Pending Finance Approval are system-managed: the status is read-only
// until Finance approves (which sets In Progress automatically).
export const isSystemManaged = (kind) => kind === "draft" || kind === "pending";
