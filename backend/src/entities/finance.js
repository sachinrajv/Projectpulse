import { defineCrud, sel } from "../crud.js";

/* Finance (flow2): billing periods, billing records, the resource snapshot per billing,
   invoices and timesheets. Copied from the flow definitions; scripts/verify-flows.mjs
   re-checks every column and response key.

   Flow quirks carried over:
   - Billing CREATE ignores the caller's approvalStatusId and always inserts 6
     (the flow hard-codes it; the approval status only changes on EDIT).
   - Invoice and Timesheet answer as text ("@{...}" fields, "" for NULL); Billing,
     BillingPeriod and BillingResource answer with plain values.
   - Invoice.active is returned as a real boolean (the flow sent "True"/"False" text,
     which the app reads as always-true).
*/

export const finance = {
  // Response: guid, billingMonth, billingYear, periodName, periodStartDate, periodEndDate, isClosed, active
  BillingPeriod: defineCrud({
    table: "BillingPeriod", pk: "BillingPeriodId",
    select: {
      guid: "BillingPeriodId", billingMonth: "BillingMonth", billingYear: "BillingYear", periodName: "PeriodName",
      periodStartDate: sel.date("PeriodStartDate"), periodEndDate: sel.date("PeriodEndDate"),
      isClosed: "IsClosed", active: "IsActive",
    },
    fields: [
      { in: "billingMonth", col: "BillingMonth", type: "int" },
      { in: "billingYear", col: "BillingYear", type: "int" },
      { in: "periodName", col: "PeriodName", type: "str" },
      { in: "periodStartDate", col: "PeriodStartDate", type: "date" },
      { in: "periodEndDate", col: "PeriodEndDate", type: "date" },
      { in: "isClosed", col: "IsClosed", type: "bool" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", // the table has no ModifiedOn
  }),

  Billing: defineCrud({
    table: "Billing", pk: "BillingId",
    select: {
      guid: "BillingId", projectId: "ProjectId", billingPeriodId: "BillingPeriodId", billingTypeId: "BillingTypeId",
      amount: "Amount", currencyId: "CurrencyId", milestoneName: "MilestoneName", submittedByUserId: "SubmittedByUserId",
      approvalStatusId: "ApprovalStatusId", approvedByUserId: "ApprovedByUserId", approvedOn: sel.dt("ApprovedOn"),
      remarks: "Remarks", active: "IsActive",
    },
    fields: [
      { in: "projectId", col: "ProjectId", type: "int" },
      { in: "billingPeriodId", col: "BillingPeriodId", type: "int" },
      { in: "billingTypeId", col: "BillingTypeId", type: "int" },
      { in: "amount", col: "Amount", type: "dec" },
      { in: "currencyId", col: "CurrencyId", type: "int" },
      { in: "milestoneName", col: "MilestoneName", type: "str" },
      { in: "submittedByUserId", col: "SubmittedByUserId", type: "int", edit: false },
      { col: "ApprovalStatusId", type: "int", const: 6, edit: false },            // CREATE: always 6
      { in: "approvalStatusId", col: "ApprovalStatusId", type: "int", create: false }, // EDIT: caller's value
      { in: "approvedByUserId", col: "ApprovedByUserId", type: "int", create: false },
      { in: "approvedOn", col: "ApprovedOn", type: "datetime", create: false },
      { in: "remarks", col: "Remarks", type: "str", create: false },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true,
  }),

  // Snapshot of who worked how many hours on a billing record (never recalculated later).
  BillingResource: defineCrud({
    table: "BillingResource", pk: "BillingResourceId",
    select: {
      guid: "BillingResourceId", billingId: "BillingId", userId: "UserId", hoursPerDay: "HoursPerDay",
      workingDays: "WorkingDays", plannedHours: "PlannedHours", actualHours: "ActualHours", active: "Active",
    },
    fields: [
      { in: "billingId", col: "BillingId", type: "int", edit: false },
      { in: "userId", col: "UserId", type: "int", edit: false },
      { in: "hoursPerDay", col: "HoursPerDay", type: "dec" },
      { in: "workingDays", col: "WorkingDays", type: "int" },
      { in: "plannedHours", col: "PlannedHours", type: "dec" },
      { in: "actualHours", col: "ActualHours", type: "dec" },
      { in: "active", col: "Active", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", // ModifiedOn is written on EDIT only
  }),

  Invoice: defineCrud({
    table: "Invoice", pk: "InvoiceId",
    select: {
      guid: sel.numTxt("InvoiceId"), invoiceNumber: sel.txt("InvoiceNumber"), clientId: sel.numTxt("ClientId"),
      projectId: sel.numTxt("ProjectId"), amount: sel.numTxt("Amount"),
      invoiceDate: sel.dateTxt("InvoiceDate"), dueDate: sel.dateTxt("DueDate"),
      currencyId: sel.numTxt("CurrencyId"), billingPeriodId: sel.numTxt("BillingPeriodId"),
      totalBillableHours: sel.numTxt("TotalBillableHours"), invoiceStatusId: sel.numTxt("InvoiceStatusId"),
      paymentDate: sel.dateTxt("PaymentDate"), paymentReference: sel.txt("PaymentReference"),
      financeRemarks: sel.txt("FinanceRemarks"), billingId: sel.numTxt("BillingId"),
      active: "IsActive",
    },
    fields: [
      { in: "invoiceNumber", col: "InvoiceNumber", type: "str" },
      { in: "clientId", col: "ClientId", type: "int" },
      { in: "projectId", col: "ProjectId", type: "int" },
      { in: "amount", col: "Amount", type: "dec" },
      { in: "invoiceDate", col: "InvoiceDate", type: "date" },
      { in: "dueDate", col: "DueDate", type: "date" },
      { in: "currencyId", col: "CurrencyId", type: "int" },
      { in: "billingPeriodId", col: "BillingPeriodId", type: "int" },
      { in: "totalBillableHours", col: "TotalBillableHours", type: "dec" },
      { in: "invoiceStatusId", col: "InvoiceStatusId", type: "int" },
      { in: "paymentDate", col: "PaymentDate", type: "date", create: false },
      { in: "paymentReference", col: "PaymentReference", type: "str", create: false },
      { in: "financeRemarks", col: "FinanceRemarks", type: "str" },
      { in: "billingId", col: "BillingId", type: "int" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true,
  }),

  Timesheet: defineCrud({
    table: "Timesheet", pk: "TimesheetId",
    select: {
      guid: sel.numTxt("TimesheetId"), employeeUserId: sel.numTxt("EmployeeUserID"), projectId: sel.numTxt("ProjectId"),
      weekEnding: sel.dateTxt("WeekEnding"), hours: sel.numTxt("Hours"), status: sel.txt("Status"),
      billingPeriodId: sel.numTxt("BillingPeriodId"), approvalStatusId: sel.numTxt("ApprovalStatusId"),
      approvedByUserId: sel.numTxt("ApprovedByUserId"), approvedOn: sel.dtTxt("ApprovedOn"),
    },
    fields: [
      { in: "employeeUserId", col: "EmployeeUserID", type: "int", edit: false },
      { in: "projectId", col: "ProjectId", type: "int", edit: false },
      { in: "weekEnding", col: "WeekEnding", type: "date", edit: false },
      { in: "hours", col: "Hours", type: "dec" },
      { in: "status", col: "Status", type: "str" },
      { in: "billingPeriodId", col: "BillingPeriodId", type: "int", edit: false },
      { in: "approvalStatusId", col: "ApprovalStatusId", type: "int", create: false },
      { in: "approvedByUserId", col: "ApprovedByUserId", type: "int", create: false },
      { in: "approvedOn", col: "ApprovedOn", type: "datetime", create: false },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true,
  }),
};
