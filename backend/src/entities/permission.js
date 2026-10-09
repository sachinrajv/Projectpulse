import { query, sql } from "../db.js";
import { httpError } from "../crud.js";

/* ============================================================
   Permission — entity "Permission". Actions the frontend uses:
     LIST_MODULES
     LIST_ROLE_PERMISSIONS  { roleId }
     SAVE_ROLE_PERMISSION   { roleId, moduleId, canView..canApprove }  (upsert)
     LIST_USER_PERMISSIONS  { userId }
     SAVE_USER_PERMISSION   { userId, moduleId, canView..canApprove }  (upsert, marks IsOverride)
     CLEAR_USER_PERMISSION  { userId, moduleId }                       (delete override)

   The app resolves effective access itself in code (role grids OR-ed
   together, user overrides replace the role result), so the API only
   stores and returns the raw rows. GET_EFFECTIVE (a SQL view) is not
   called by the app and is not implemented.
   ============================================================ */

const FLAGS = ["canView", "canCreate", "canEdit", "canDelete", "canApprove"];
const flagCols = `CanView AS canView, CanCreate AS canCreate, CanEdit AS canEdit, CanDelete AS canDelete, CanApprove AS canApprove`;

const need = (body, ...keys) => {
  for (const k of keys) if (!body[k]) throw httpError(400, `${k} is required for ${body.action}.`);
};
const intParam = (name, value) => ({ name, type: sql.Int, value: Number(value) });
const flagParams = (body) => FLAGS.map((k) => ({ name: k, type: sql.Bit, value: !!body[k] }));

const listFor = (table, keyCol, id) =>
  query(
    `SELECT ModuleId AS moduleId, ${flagCols} FROM [dbo].[${table}] WHERE ${keyCol} = @id AND IsActive = 1 ORDER BY ModuleId`,
    [intParam("id", id)]
  );

// UPDATE-then-INSERT inside one transaction, so a double click can't create two rows.
const upsert = (table, keyCol, extraCols = "", extraVals = "", extraSet = "") =>
  `SET XACT_ABORT ON;
   BEGIN TRAN;
   UPDATE [dbo].[${table}] WITH (UPDLOCK, SERIALIZABLE)
      SET CanView = @canView, CanCreate = @canCreate, CanEdit = @canEdit, CanDelete = @canDelete, CanApprove = @canApprove,
          IsActive = 1${extraSet}, ModifiedOn = SYSUTCDATETIME()
    WHERE ${keyCol} = @id AND ModuleId = @moduleId;
   IF @@ROWCOUNT = 0
     INSERT INTO [dbo].[${table}] (${keyCol}, ModuleId, CanView, CanCreate, CanEdit, CanDelete, CanApprove, IsActive${extraCols}, CreatedOn)
     VALUES (@id, @moduleId, @canView, @canCreate, @canEdit, @canDelete, @canApprove, 1${extraVals}, SYSUTCDATETIME());
   COMMIT;`;

const ROLE_UPSERT = upsert("RolePermission", "RoleId");
const USER_UPSERT = upsert("UserPermission", "UserId", ", IsOverride", ", 1", ", IsOverride = 1");

export const permission = {
  LIST_MODULES: () =>
    query(
      `SELECT ModuleId AS moduleId, ModuleKey AS moduleKey, ModuleName AS moduleName, ModuleGroup AS moduleGroup, DisplayOrder AS displayOrder
         FROM [dbo].[Module] WHERE IsActive = 1 ORDER BY DisplayOrder, ModuleId`
    ),

  async LIST_ROLE_PERMISSIONS(body) {
    need(body, "roleId");
    return listFor("RolePermission", "RoleId", body.roleId);
  },

  async SAVE_ROLE_PERMISSION(body) {
    need(body, "roleId", "moduleId");
    await query(ROLE_UPSERT, [intParam("id", body.roleId), intParam("moduleId", body.moduleId), ...flagParams(body)]);
    return listFor("RolePermission", "RoleId", body.roleId);
  },

  async LIST_USER_PERMISSIONS(body) {
    need(body, "userId");
    return listFor("UserPermission", "UserId", body.userId);
  },

  async SAVE_USER_PERMISSION(body) {
    need(body, "userId", "moduleId");
    await query(USER_UPSERT, [intParam("id", body.userId), intParam("moduleId", body.moduleId), ...flagParams(body)]);
    return listFor("UserPermission", "UserId", body.userId);
  },

  async CLEAR_USER_PERMISSION(body) {
    need(body, "userId", "moduleId");
    await query(`DELETE FROM [dbo].[UserPermission] WHERE UserId = @id AND ModuleId = @moduleId`, [
      intParam("id", body.userId),
      intParam("moduleId", body.moduleId),
    ]);
    return listFor("UserPermission", "UserId", body.userId);
  },
};
