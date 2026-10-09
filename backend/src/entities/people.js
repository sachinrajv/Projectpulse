import { defineCrud, sel } from "../crud.js";

/* Users and their role assignments. Needed for sign-in itself: after the
   password checks out, the app loads the employee list and the user's roles. */

export const people = {
  // Response keeps the ORIGINAL PascalCase column names the frontend reads:
  // "UserID","EmpID","FirstName","LastName","Gender","JobTitle","DepartmentID",
  // "IsActive","Email","ReportingManagerId","LocationId"
  // NOTE: the table column really is spelled "LastNmae" — it is exposed as LastName.
  User: defineCrud({
    table: "Users", pk: "UserID",
    select: {
      UserID: "UserID", EmpID: "EmpID", FirstName: "FirstName", LastName: "LastNmae", Gender: "Gender",
      JobTitle: "JobTitle", DepartmentID: "DepartmentID", IsActive: "IsActive", Email: sel.txt("Email"),
      ReportingManagerId: sel.numTxt("ReportingManagerId"), LocationId: sel.numTxt("LocationId"),
    },
    fields: [
      { in: "empId", col: "EmpID", type: "str" },
      { in: "firstName", col: "FirstName", type: "str" },
      { in: "lastName", col: "LastNmae", type: "str" },
      { in: "gender", col: "Gender", type: "str" },
      { in: "jobTitle", col: "JobTitle", type: "str" },
      { in: "departmentId", col: "DepartmentID", type: "int" },
      { in: "active", col: "IsActive", type: "bool" },
      { in: "email", col: "Email", type: "str" },
      { in: "reportingManagerId", col: "ReportingManagerId", type: "int" },
      { in: "locationId", col: "LocationId", type: "int" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn",
  }),

  // Response: "guid","userId","roleId","active"   (guid = the table's int "Id")
  UserRoles: defineCrud({
    table: "UserRoles", pk: "Id",
    select: { guid: "Id", userId: "UserId", roleId: "RoleId", active: "IsActive" },
    fields: [
      { in: "userId", col: "UserId", type: "int" },
      { in: "roleId", col: "RoleId", type: "int" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true, guidCol: "Guid",
  }),
};
