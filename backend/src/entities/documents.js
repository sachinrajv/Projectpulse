import { query, sql } from "../db.js";
import { defineCrud, sel, httpError } from "../crud.js";

/* Project documents (flow2). The list never carries file bytes — the file is fetched one
   at a time (ProjectDocumentFile) when someone clicks View/Download. Files travel as base64
   text without a "data:" prefix and are stored in the varbinary FileData column. */

export const documents = {
  // Response: guid, projectId, docName, docType, uploadedByUserId, uploadDate, fileName, active.
  // EDIT can only rename / retype / (de)activate — the project, uploader, date and file are fixed at creation.
  ProjectDocument: defineCrud({
    table: "ProjectDocument", pk: "ProjectDocumentId",
    select: {
      guid: "ProjectDocumentId", projectId: "ProjectId", docName: "DocName", docType: "DocType",
      uploadedByUserId: "UploadedByUserID", uploadDate: sel.date("UploadDate"), fileName: "FileName", active: "IsActive",
    },
    fields: [
      { in: "projectId", col: "ProjectId", type: "int", edit: false },
      { in: "docName", col: "DocName", type: "str" },
      { in: "docType", col: "DocType", type: "str" },
      { in: "uploadedByUserId", col: "UploadedByUserID", type: "int", edit: false },
      { in: "uploadDate", col: "UploadDate", type: "date", edit: false },
      { in: "active", col: "IsActive", type: "bool" },
      { in: "fileName", col: "FileName", type: "str", edit: false },
      { in: "fileData", col: "FileData", type: "binary", edit: false },
    ],
    createdOn: "CreatedOn",
  }),

  // One document with its bytes. The app calls this WITHOUT an action ({ entity, guid }),
  // so it is the entity's DEFAULT handler. Returns a one-element array.
  ProjectDocumentFile: {
    async DEFAULT(body) {
      if (!body.guid) throw httpError(400, "guid is required for ProjectDocumentFile.");
      const rows = await query(
        `SELECT ProjectDocumentId, DocName, DocType, FileName, FileData FROM [dbo].[ProjectDocument] WHERE ProjectDocumentId = @guid`,
        [{ name: "guid", type: sql.Int, value: Number(body.guid) }]
      );
      return rows.map((r) => ({
        guid: String(r.ProjectDocumentId),
        docName: r.DocName ?? "",
        docType: r.DocType ?? "",
        fileName: r.FileName ?? "",
        fileData: r.FileData ? Buffer.from(r.FileData).toString("base64") : "",
      }));
    },
  },
};
