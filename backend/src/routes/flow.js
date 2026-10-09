import { Router } from "express";
import { dispatch } from "../entities/index.js";
import { sendMail } from "../mail.js";

const router = Router();

/* The frontend calls three relative paths (they used to be proxied to
   Power Automate). Keeping the same paths and the same {entity, action, ...}
   body means the frontend code does not change — only where the proxy points.

   /flow and /flow2 were two separate flows only because one flow got too big;
   here they share one registry, so any entity works on either path. */
router.post(["/flow", "/flow2"], async (req, res, next) => {
  const started = Date.now();
  const { entity, action } = req.body || {};
  try {
    const rows = await dispatch(req.body || {});
    res.json(rows);
    console.log(`${req.path} ${entity}.${action} ok ${rows.length} rows ${Date.now() - started}ms`);
  } catch (err) {
    console.error(`${req.path} ${entity}.${action} FAILED ${Date.now() - started}ms: ${err.message}`);
    next(err);
  }
});

/* Email sender: the frontend posts { to, cc, subject, body } (HTML body) and treats any
   2xx as "sent". On failure it answers non-2xx so the frontend writes a "Failed"
   NotificationLog row with the reason, instead of believing a mail went out. */
router.post("/auditflow", async (req, res, next) => {
  const { to, cc, subject, body } = req.body || {};
  try {
    await sendMail({ to, cc, subject, body });
    res.json({ success: true });
    console.log(`/auditflow mail ok -> ${String(to).slice(0, 80)}`);
  } catch (err) {
    console.error(`/auditflow mail FAILED: ${err.message}`);
    next(err);
  }
});

export default router;
