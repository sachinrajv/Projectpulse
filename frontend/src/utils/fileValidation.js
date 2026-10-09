// fileValidation.js — supported attachment formats for project documents.
// Per the approved requirement: PDF, DOCX, XLSX, JPG, PNG only.
export const ALLOWED_DOC_EXTENSIONS = ["pdf", "docx", "xlsx", "jpg", "jpeg", "png"];

// Pass to <input type="file" accept=...> so the picker only offers these types.
export const DOC_ACCEPT_ATTR = ".pdf,.docx,.xlsx,.jpg,.jpeg,.png";

export const UNSUPPORTED_FORMAT_MESSAGE = "Unsupported file format. Please upload files in PDF, DOCX, XLSX, JPG, or PNG format only.";

export function isAllowedDocFile(fileName) {
  const name = String(fileName || "");
  const dot = name.lastIndexOf(".");
  if (dot < 0) return false;
  return ALLOWED_DOC_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase());
}
