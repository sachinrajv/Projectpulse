import { defineCrud, sel } from "../crud.js";

/* Holiday calendar, project approvals and the audit log (flow2). */

export const records = {
  // Response: "guid","holidayDate","holidayName","locationId","active". locationId is optional
  // (NULL = company-wide holiday).
  Holiday: defineCrud({
    table: "Holiday", pk: "HolidayId",
    select: { guid: "HolidayId", holidayDate: sel.date("HolidayDate"), holidayName: "HolidayName", locationId: "LocationId", active: "Active" },
    fields: [
      { in: "holidayDate", col: "HolidayDate", type: "date" },
      { in: "holidayName", col: "HolidayName", type: "str" },
      { in: "locationId", col: "LocationId", type: "int" },
      { in: "active", col: "Active", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", // ModifiedOn is written on EDIT only
  }),

  // CREATE records who asked and the CP%; the decision (status, comments, decider, time) is
  // written afterwards by EDIT — the project page does CREATE then EDIT.
  ProjectApproval: defineCrud({
    table: "ProjectApproval", pk: "ApprovalId",
    select: {
      guid: sel.numTxt("ApprovalId"), projectId: sel.numTxt("ProjectId"), cpPercent: sel.numTxt("CPPercent"),
      requestedByUserId: sel.numTxt("RequestedByUserId"), approvalStatusId: sel.numTxt("ApprovalStatusId"),
      comments: sel.txt("Comments"), decidedByUserId: sel.numTxt("DecidedByUserId"), decidedOn: sel.dtTxt("DecidedOn"),
      active: "IsActive", // real boolean (the flow sent "True"/"False" text, which the app reads as always-true)
    },
    fields: [
      { in: "projectId", col: "ProjectId", type: "int", edit: false },
      { in: "cpPercent", col: "CPPercent", type: "dec", edit: false },
      { in: "requestedByUserId", col: "RequestedByUserId", type: "int", edit: false },
      { in: "approvalStatusId", col: "ApprovalStatusId", type: "int" },
      { in: "comments", col: "Comments", type: "str", create: false },
      { in: "decidedByUserId", col: "DecidedByUserId", type: "int", create: false },
      { in: "decidedOn", col: "DecidedOn", type: "datetime", create: false },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn",
  }),

  // Append-only log: LIST and CREATE only. CREATE answers [] — the app ignores the result and the
  // flow's habit of re-sending the whole (ever-growing) log on every insert is not worth keeping.
  AuditLog: defineCrud({
    table: "AuditLog", pk: "AuditLogId",
    select: {
      guid: sel.numTxt("AuditLogId"), screenName: sel.txt("ScreenName"), auditAction: sel.txt("Action"),
      recordName: sel.txt("RecordName"), byUser: sel.txt("ByUser"), loggedOn: sel.dtTxt("LoggedOn"),
    },
    fields: [
      { in: "screenName", col: "ScreenName", type: "str" },
      { in: "auditAction", col: "Action", type: "str" },
      { in: "recordName", col: "RecordName", type: "str" },
      { in: "byUser", col: "ByUser", type: "str" },
    ],
    createdOn: "LoggedOn",
    actions: ["LIST", "CREATE"],
    createReturnsList: false,
  }),
};
