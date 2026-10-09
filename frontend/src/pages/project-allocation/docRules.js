// docRules.js — supporting-document rule for the project form:
// a PO Number needs a "Purchase Order" document, a SOW Reference needs a "SOW" document.
export const PO_DOC_TYPE = "Purchase Order";
export const SOW_DOC_TYPE = "SOW";

// A document counts once it is already saved (has a guid) or has a file chosen
// and waiting to upload (fileData).
const hasDoc = (docs, type) => (docs || []).some((d) => d.docType === type && (d.guid || d.fileData));

// -> [{ field: "PO Number", value: "PO-1", docType: "Purchase Order" }, ...] for whatever is missing.
export function missingSupportingDocs(form) {
  const missing = [];
  const po = String(form.poNumber || "").trim();
  const sow = String(form.sowReference || "").trim();
  if (po && !hasDoc(form.documents, PO_DOC_TYPE)) missing.push({ field: "PO Number", value: po, docType: PO_DOC_TYPE });
  if (sow && !hasDoc(form.documents, SOW_DOC_TYPE)) missing.push({ field: "SOW Reference", value: sow, docType: SOW_DOC_TYPE });
  return missing;
}

export function missingDocsMessage(missing) {
  return missing
    .map((m) => `You have entered ${m.field} "${m.value}" — please upload the ${m.docType} document (Documents section, Type: ${m.docType}).`)
    .join(" ");
}
