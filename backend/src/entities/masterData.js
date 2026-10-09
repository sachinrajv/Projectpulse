import { defineCrud, sel } from "../crud.js";

/* ============================================================
   Step 2 — simple master-data entities.

   Response keys are copied EXACTLY from the flows' Select actions
   (see the RESPONSE SHAPES comment in the frontend's flows.js),
   because the frontend wrappers read those exact keys. Several are
   inconsistent on purpose (e.g. Department returns "Status",
   DealStatus has no code) — don't "tidy" them or the screens break.

   Request keys the generic screens send: guid, code, name, active.
   ============================================================ */

export const masterData = {
  // Response: "Department Code","Department Name","Status","guid"
  Department: defineCrud({
    table: "Department", pk: "DepartmentId",
    select: { guid: "DepartmentId", "Department Code": "DepartmentCode", "Department Name": "DepartmentName", Status: "IsActive" },
    fields: [
      { in: "code", col: "DepartmentCode", type: "str" },
      { in: "name", col: "DepartmentName", type: "str" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn",
  }),

  // Response: "CategoryCode","CategoryName","IsActive","guid"  (table columns have spaces)
  ProjectCategory: defineCrud({
    table: "ProjectCategory", pk: "CategoryId",
    select: { guid: "CategoryId", CategoryCode: "Category Code", CategoryName: "Category Name", IsActive: "IsActive" },
    fields: [
      { in: "code", col: "Category Code", type: "str" },
      { in: "name", col: "Category Name", type: "str" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
  }),

  // Response: "RoleCode","RoleName","IsActive","guid"  (table is "Roles", columns have spaces)
  Role: defineCrud({
    table: "Roles", pk: "RoleId",
    select: { guid: "RoleId", RoleCode: "Role Code", RoleName: "Role Name", IsActive: "IsActive" },
    fields: [
      { in: "code", col: "Role Code", type: "str" },
      { in: "name", col: "Role Name", type: "str" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
  }),

  // Response: "guid","name","active"  (no code column in the table)
  DealStatus: defineCrud({
    table: "DealStatus", pk: "DealStatusId",
    select: { guid: "DealStatusId", name: "DealStatusName", active: "IsActive" },
    fields: [
      { in: "name", col: "DealStatusName", type: "str" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true, // ModifiedOn is NOT NULL here
  }),

  // Response: "guid","code","name","active"
  BillingType: defineCrud({
    table: "BillingType", pk: "BillingTypeId",
    select: { guid: "BillingTypeId", code: "BillingTypeCode", name: "BillingTypeName", active: "IsActive" },
    fields: [
      { in: "code", col: "BillingTypeCode", type: "str" },
      { in: "name", col: "BillingTypeName", type: "str" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true,
  }),

  // Response: "guid","ApprovalStatusCode","ApprovalStatusName","IsActive"
  // guid = the table's int "Id" column, NOT the uniqueidentifier "Guid" column.
  ApprovalStatus: defineCrud({
    table: "ApprovalStatus", pk: "Id",
    select: { guid: "Id", ApprovalStatusCode: "ApprovalStatusCode", ApprovalStatusName: "ApprovalStatusName", IsActive: "IsActive" },
    fields: [
      { in: "code", col: "ApprovalStatusCode", type: "str" },
      { in: "name", col: "ApprovalStatusName", type: "str" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true, guidCol: "Guid",
  }),

  // Response: "guid","ProjectStatusCode","ProjectStatusName","IsActive"  (guid = "Id")
  ProjectStatus: defineCrud({
    table: "ProjectStatus", pk: "Id",
    select: { guid: "Id", ProjectStatusCode: "ProjectStatusCode", ProjectStatusName: "ProjectStatusName", IsActive: "IsActive" },
    fields: [
      { in: "code", col: "ProjectStatusCode", type: "str" },
      { in: "name", col: "ProjectStatusName", type: "str" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true, guidCol: "Guid",
  }),

  // Response: "guid","InvoiceStatusCode","InvoiceStatusName","IsActive"  (guid = "InvoiceStatusId")
  InvoiceStatus: defineCrud({
    table: "InvoiceStatus", pk: "InvoiceStatusId",
    select: { guid: "InvoiceStatusId", InvoiceStatusCode: "InvoiceStatusCode", InvoiceStatusName: "InvoiceStatusName", IsActive: "IsActive" },
    fields: [
      { in: "code", col: "InvoiceStatusCode", type: "str" },
      { in: "name", col: "InvoiceStatusName", type: "str" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn",
  }),

  // Response: "CountryCode","CountryName","IsActive","guid","currencyId"
  // Request carries the currency as "countryCurrencyId".
  Country: defineCrud({
    table: "Country", pk: "CountryId",
    select: { guid: "CountryId", CountryCode: "CountryCode", CountryName: "CountryName", IsActive: "IsActive", currencyId: sel.numTxt("CurrencyId") },
    fields: [
      { in: "code", col: "CountryCode", type: "str" },
      { in: "name", col: "CountryName", type: "str" },
      { in: "active", col: "IsActive", type: "bool" },
      { in: "countryCurrencyId", col: "CurrencyId", type: "int" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true,
  }),

  // Response: "guid","code","name","active"
  Designation: defineCrud({
    table: "Designation", pk: "DesignationId",
    select: { guid: "DesignationId", code: "DesignationCode", name: "DesignationName", active: "IsActive" },
    fields: [
      { in: "code", col: "DesignationCode", type: "str" },
      { in: "name", col: "DesignationName", type: "str" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true,
  }),

  // Response: "guid","code","name","countryId","active"
  Location: defineCrud({
    table: "Location", pk: "LocationId",
    select: { guid: "LocationId", code: "LocationCode", name: "LocationName", countryId: "CountryId", active: "IsActive" },
    fields: [
      { in: "code", col: "LocationCode", type: "str" },
      { in: "name", col: "LocationName", type: "str" },
      { in: "countryId", col: "CountryId", type: "int" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true,
  }),

  // Response: "guid","code","name","symbol","countryId","active"
  Currency: defineCrud({
    table: "Currency", pk: "CurrencyId",
    select: { guid: "CurrencyId", code: "CurrencyCode", name: "CurrencyName", symbol: "Symbol", countryId: "CountryId", active: "IsActive" },
    fields: [
      { in: "code", col: "CurrencyCode", type: "str" },
      { in: "name", col: "CurrencyName", type: "str" },
      { in: "symbol", col: "Symbol", type: "str" },
      { in: "countryId", col: "CountryId", type: "int" },
      { in: "active", col: "IsActive", type: "bool" },
    ],
    createdOn: "CreatedOn", modifiedOn: "ModifiedOn", modifiedOnInsert: true,
  }),
};
