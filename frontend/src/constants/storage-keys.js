export const LS_CURRENT_USER = "pp_current_user";

// Mirror of the signed-in user's effective permissions + admin flag,
// written by PermissionContext on every (re)load. utils/audit.js reads
// this synchronously to decide whether the current user is allowed to
// trigger outbound Finance/Approval notification emails (see the
// "Mail Notifications" permission module in constants/modules.js) —
// logAudit() is a plain function outside React, so it can't call the
// usePermissions() hook directly.
export const LS_PERMISSIONS_CACHE = "pp_permissions_cache";

