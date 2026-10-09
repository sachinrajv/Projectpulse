// Maps the `screen` text written by logAudit() (what the Audit Log table
// stores) to the module key of the screen that handles it, so a notification
// can open the right screen. Screens that no longer exist in the left nav
// (e.g. the parked "User role") map to nothing and are not shown.
const SCREEN_TO_MODULE = {
  "project": "project-dashboard",
  "project document": "project-dashboard",
  "project approval": "project-approval",
  "resource allocation": "resource-allocation",
  "project resources": "project-resources-txn",
  "pipeline project": "pipeline-project",
  "billing": "billing",
  "timesheet approval": "billing",
  "link invoice": "link-invoice",
  "holiday": "holiday",
  "user": "user",
  "department": "department",
  "country": "country",
  "role": "roles",
  "client": "client",
  "category": "project-category",
  "project status": "project-status",
  "deal status": "project-deal-status",
  "billing type": "billing-type",
  "location": "location",
  "designation": "designation",
  "currency": "currency",
  "invoice status": "invoice-status",
  "permissions": "permissions",
};

export function moduleForAuditScreen(screen) {
  return SCREEN_TO_MODULE[String(screen || "").trim().toLowerCase()] || "";
}
