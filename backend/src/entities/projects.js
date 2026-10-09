import { defineCrud, sel } from "../crud.js";

/* ============================================================
   Clients and projects (flow1). Copied from the flow definitions;
   scripts/verify-flows.mjs re-checks every column and response key.

   Notes carried over from the flows:
   - Project: CREATE does not write DealStatusId (only EDIT does) and
     neither action writes ApprovalStatusId (read-only here).
   - Dates come back as "YYYY-MM-DDT00:00:00"; the "@{...}" fields come
     back as text with "" for NULL (see sel.* in crud.js).
   ============================================================ */

export const projects = {
  // Response: "guid","clientCode","clientName","countryId","active"
  Client: defineCrud({
    table: "Client", pk: "ClientId",
    select: { guid: "ClientId", clientCode: "ClientCode", clientName: "ClientName", countryId: "CountryId", active: "IsActive" },
    fields: [
      { in: "clientCode", col: "ClientCode", type: "str" },
      { in: "clientName", col: "ClientName", type: "str" },
      { in: "countryId", col: "CountryId", type: "int" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true,
  }),

  // Response: "guid","clientId","contactName","contactEmail","contactPhone","active"
  ClientContacts: defineCrud({
    table: "ClientContact", pk: "ContactId",
    select: { guid: "ContactId", clientId: "ClientId", contactName: "ContactName", contactEmail: "Email", contactPhone: "Phone", active: "IsActive" },
    fields: [
      { in: "clientId", col: "ClientId", type: "int" },
      { in: "contactName", col: "ContactName", type: "str" },
      { in: "contactEmail", col: "Email", type: "str" },
      { in: "contactPhone", col: "Phone", type: "str" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true,
  }),

  Project: defineCrud({
    table: "Project", pk: "ProjectId",
    select: {
      guid: "ProjectId", projectCode: "ProjectCode", projectName: "ProjectName",
      categoryId: "CategoryId", clientId: "ClientId", billingTypeId: "BillingTypeId", dealStatusId: "DealStatusId",
      startDate: sel.date("StartDate"), endDate: sel.date("EndDate"), active: "IsActive",
      zohoProjectId: sel.txt("ZohoProjectId"),
      projectManagerUserId: sel.numTxt("ProjectManagerUserId"),
      deliveryHeadUserId: sel.numTxt("DeliveryHeadUserId"),
      projectDepartmentId: sel.numTxt("DepartmentId"),
      currencyId: sel.numTxt("CurrencyId"),
      projectValue: sel.numTxt("ProjectValue"),
      geography: sel.txt("Geography"),
      poNumber: sel.txt("PONumber"),
      sowReference: sel.txt("SOWReference"),
      remarks: sel.txt("Remarks"),
      projectStatusId: sel.numTxt("ProjectStatusId"),
      approvalStatusId: sel.numTxt("ApprovalStatusId"),
    },
    fields: [
      { in: "projectCode", col: "ProjectCode", type: "str" },
      { in: "projectName", col: "ProjectName", type: "str" },
      { in: "categoryId", col: "CategoryId", type: "int" },
      { in: "clientId", col: "ClientId", type: "int" },
      { in: "billingTypeId", col: "BillingTypeId", type: "int" },
      { in: "dealStatusId", col: "DealStatusId", type: "int", create: false }, // flow writes it on EDIT only
      { in: "startDate", col: "StartDate", type: "date" },
      { in: "endDate", col: "EndDate", type: "date" },
      { in: "active", col: "IsActive", type: "bool" },
      { in: "zohoProjectId", col: "ZohoProjectId", type: "str" },
      { in: "projectManagerUserId", col: "ProjectManagerUserId", type: "int" },
      { in: "deliveryHeadUserId", col: "DeliveryHeadUserId", type: "int" },
      { in: "projectDepartmentId", col: "DepartmentId", type: "int" },
      { in: "currencyId", col: "CurrencyId", type: "int" },
      { in: "projectValue", col: "ProjectValue", type: "dec" },
      { in: "geography", col: "Geography", type: "str" },
      { in: "poNumber", col: "PONumber", type: "str" },
      { in: "sowReference", col: "SOWReference", type: "str" },
      { in: "remarks", col: "Remarks", type: "str" },
      { in: "projectStatusId", col: "ProjectStatusId", type: "int" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true,
  }),

  // The live allocation table. Response: guid, projectId, userId, roleId, allocationPct, weeklyHours,
  // billable, startDate, endDate, designationId, resourceDepartmentId
  ProjectResource: defineCrud({
    table: "ProjectResource", pk: "ProjectResourceId",
    select: {
      guid: "ProjectResourceId", projectId: "ProjectId", userId: "UserID", roleId: "RoleId",
      allocationPct: "AllocationPct", weeklyHours: "WeeklyHours", billable: "IsBillable",
      startDate: sel.date("StartDate"), endDate: sel.date("EndDate"),
      designationId: sel.numTxt("DesignationId"), resourceDepartmentId: sel.numTxt("DepartmentId"),
    },
    fields: [
      { in: "projectId", col: "ProjectId", type: "int" },
      { in: "userId", col: "UserID", type: "int" },
      { in: "roleId", col: "RoleId", type: "int" },
      { in: "allocationPct", col: "AllocationPct", type: "dec" },
      { in: "weeklyHours", col: "WeeklyHours", type: "dec" },
      { in: "billable", col: "IsBillable", type: "bool" },
      { in: "startDate", col: "StartDate", type: "date" },
      { in: "endDate", col: "EndDate", type: "date" },
      { in: "designationId", col: "DesignationId", type: "int" },
      { in: "resourceDepartmentId", col: "DepartmentId", type: "int" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true,
  }),

  // Pre-sales pipeline. Several columns are sent under pipeline-specific names
  // (pipelineDepartmentId, pipelineBillingTypeId, pipelineCurrencyId, pipelineGeography, pipelineRemarks).
  PipelineProject: defineCrud({
    table: "PipelineProject", pk: "PipelineProjectId",
    select: {
      guid: "PipelineProjectId", projectName: "ProjectName", clientId: "ClientId", dealValue: "DealValue",
      dealStatusId: "DealStatusId", expectedCloseDate: sel.date("ExpectedCloseDate"), ownerUserId: "OwnerUserID", active: "IsActive",
      pipelineCode: sel.txt("PipelineCode"), opportunityName: sel.txt("OpportunityName"),
      projectManagerUserId: sel.numTxt("ProjectManagerUserId"), deliveryHeadUserId: sel.numTxt("DeliveryHeadUserId"),
      pipelineDepartmentId: sel.numTxt("DepartmentId"), projectType: sel.txt("ProjectType"),
      pipelineBillingTypeId: sel.numTxt("BillingTypeId"), pipelineCurrencyId: sel.numTxt("CurrencyId"),
      expectedStartDate: sel.dateTxt("ExpectedStartDate"), durationMonths: sel.numTxt("DurationMonths"),
      probabilityPct: sel.numTxt("ProbabilityPct"), priority: sel.txt("Priority"),
      pipelineGeography: sel.txt("Geography"), pipelineRemarks: sel.txt("Remarks"),
      convertedToProjectId: sel.numTxt("ConvertedToProjectId"),
    },
    fields: [
      { in: "projectName", col: "ProjectName", type: "str" },
      { in: "clientId", col: "ClientId", type: "int" },
      { in: "dealValue", col: "DealValue", type: "dec" },
      { in: "dealStatusId", col: "DealStatusId", type: "int" },
      { in: "expectedCloseDate", col: "ExpectedCloseDate", type: "date" },
      { in: "ownerUserId", col: "OwnerUserID", type: "int" },
      { in: "active", col: "IsActive", type: "bool" },
      { in: "pipelineCode", col: "PipelineCode", type: "str" },
      { in: "opportunityName", col: "OpportunityName", type: "str" },
      { in: "projectManagerUserId", col: "ProjectManagerUserId", type: "int" },
      { in: "deliveryHeadUserId", col: "DeliveryHeadUserId", type: "int" },
      { in: "pipelineDepartmentId", col: "DepartmentId", type: "int" },
      { in: "projectType", col: "ProjectType", type: "str" },
      { in: "pipelineBillingTypeId", col: "BillingTypeId", type: "int" },
      { in: "pipelineCurrencyId", col: "CurrencyId", type: "int" },
      { in: "expectedStartDate", col: "ExpectedStartDate", type: "date" },
      { in: "durationMonths", col: "DurationMonths", type: "int" },
      { in: "probabilityPct", col: "ProbabilityPct", type: "dec" },
      { in: "priority", col: "Priority", type: "str" },
      { in: "pipelineGeography", col: "Geography", type: "str" },
      { in: "pipelineRemarks", col: "Remarks", type: "str" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", // ModifiedOn is written on EDIT only
  }),

  // History/log behind the "Project Resources" screen (separate from ProjectResource).
  // The flow's EDIT writes EndDate as "end" + date (a typo); here it writes the date.
  ProjectResourceTxn: defineCrud({
    table: "ProjectResourceTxn", pk: "ProjectResourceTxnId",
    select: {
      guid: "ProjectResourceTxnId", projectId: "ProjectId", userId: "UserID", roleId: "RoleId",
      startDate: sel.date("StartDate"), endDate: sel.date("EndDate"), allocationPct: "AllocationPct", active: "IsActive",
    },
    fields: [
      { in: "projectId", col: "ProjectId", type: "int" },
      { in: "userId", col: "UserID", type: "int" },
      { in: "roleId", col: "RoleId", type: "int" },
      { in: "startDate", col: "StartDate", type: "date" },
      { in: "endDate", col: "EndDate", type: "date" },
      { in: "allocationPct", col: "AllocationPct", type: "dec" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn",
  }),
};
