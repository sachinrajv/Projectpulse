import { config } from "./config.js";
import { httpError } from "./crud.js";

/* Email. The ONLY thing that still goes through Power Automate.

   Audit mails, business-event mails (finance, project, approval updates) and
   password-reset codes all reach the API at /auditflow (or Auth.REQUEST_RESET) as
   { to, cc, subject, body }. The API forwards exactly those four fields to the old
   mail flow's HTTP trigger (MAIL_FLOW_URL in .env), whose "Send an email (V2)" step
   sends the message. Nothing else is ever sent to a flow: listing, create, edit and
   delete all go straight to SQL.

   Without MAIL_FLOW_URL the API answers 501, so the frontend records the mail as
   "Failed" in the Notification Log instead of pretending it was sent. */
const notConfigured = async () => {
  throw httpError(501, "Email is not configured on the API (set MAIL_FLOW_URL in .env).");
};

const list = (v) => String(v || "").split(/[;,]/).map((x) => x.trim()).filter(Boolean);

function flowSender() {
  return async ({ to, cc, subject, body }) => {
    if (!list(to).length) throw httpError(400, "No recipient (to) was given.");
    let res;
    try {
      res = await fetch(config.mailFlowUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: String(to), cc: String(cc || ""), subject: String(subject || ""), body: String(body || "") }),
        signal: AbortSignal.timeout(30000),
      });
    } catch (e) {
      // never put the URL (it holds a secret) in the message
      throw httpError(502, `Email could not be sent: the mail flow could not be reached (${e.cause?.code || e.name || "network error"}).`);
    }
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 200);
      throw httpError(502, `Email could not be sent: the mail flow answered ${res.status}${text ? ` (${text})` : ""}.`);
    }
  };
}

const defaultImpl = () => (config.mailFlowUrl ? flowSender() : notConfigured);
let impl = defaultImpl();

export const sendMail = (message) => impl(message); // { to, cc, subject, body(HTML) }

// Tests swap the sender here (null = back to the configured default).
export function __setMailer(fn) {
  impl = fn || defaultImpl();
}
