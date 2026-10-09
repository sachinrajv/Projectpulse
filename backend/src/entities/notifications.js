import { defineCrud, sel } from "../crud.js";

/* Notification log: one row per e-mail the app tried to send (sent, failed or skipped).
   Append-only — LIST and CREATE only, like the audit log. The table is created by
   sql/001_NotificationLog.sql (it was not in the original schema export). */
export const notifications = {
  NotificationLog: defineCrud({
    table: "NotificationLog", pk: "NotificationLogId",
    select: {
      guid: sel.numTxt("NotificationLogId"), emailType: sel.txt("EmailType"), recipientEmail: sel.txt("RecipientEmail"),
      ccEmail: sel.txt("CcEmail"), subjectLine: sel.txt("SubjectLine"), sentDate: sel.dtTxt("SentDate"),
      deliveryStatus: sel.txt("DeliveryStatus"), errorMessage: sel.txt("ErrorMessage"), sentBy: sel.txt("SentBy"),
    },
    fields: [
      { in: "emailType", col: "EmailType", type: "str" },
      { in: "recipientEmail", col: "RecipientEmail", type: "str" },
      { in: "ccEmail", col: "CcEmail", type: "str" },
      { in: "subjectLine", col: "SubjectLine", type: "str" },
      { in: "deliveryStatus", col: "DeliveryStatus", type: "str" },
      { in: "errorMessage", col: "ErrorMessage", type: "str" },
      { in: "sentBy", col: "SentBy", type: "str" },
    ],
    createdOn: "SentDate",
    actions: ["LIST", "CREATE"],
    createReturnsList: false,
  }),
};
