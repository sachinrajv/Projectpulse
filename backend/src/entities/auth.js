import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { query, sql } from "../db.js";
import { httpError } from "../crud.js";
import { sendMail } from "../mail.js";

/* ============================================================
   Auth — entity "Auth". Actions the frontend uses:
     LOGIN            { username, password }      password is checked HERE, on the server
     GET_CREDENTIAL   { username }                only says whether the username exists
     CREATE_CREDENTIAL{ userId, username, passwordHashB64 }
     REQUEST_RESET    { email }
     CONFIRM_RESET    { email, token, passwordHashB64 }

   Password hashes never leave the server. After 5 wrong passwords the
   account is locked for 15 minutes (FailedLoginAttempts / LockedUntil on
   UserCredential); a correct password resets the counter.
   ============================================================ */

const BCRYPT_RE = /^\$2[abxy]\$\d{2}\$.{53}$/;
const OTP_EXPIRY_MINUTES = 5; // the Forgot Password screen tells users 5 minutes
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_FAILS = 5;
const FAIL_WINDOW_MS = 15 * 60 * 1000;

// The browser sends base64(bcrypt text). Store the plain bcrypt text; the
// sign-in screen accepts either form, and this keeps the column readable by
// a future server-side check.
export function unwrapHash(value) {
  let s = String(value || "").trim();
  for (let i = 0; i < 4; i++) {
    if (BCRYPT_RE.test(s)) return s;
    s = Buffer.from(s, "base64").toString("utf8");
  }
  return BCRYPT_RE.test(s) ? s : "";
}

const normEmail = (v) => String(v || "").trim().toLowerCase();
const hashCode = (userId, code) => crypto.createHash("sha256").update(`${userId}:${code}`).digest("hex");

// In-memory guard against guessing the 6-digit code (resets on restart).
const failures = new Map();
const tooManyFails = (key) => {
  const f = failures.get(key);
  if (!f) return false;
  if (Date.now() - f.first > FAIL_WINDOW_MS) { failures.delete(key); return false; }
  return f.count >= MAX_FAILS;
};
const noteFail = (key) => {
  const f = failures.get(key);
  if (!f || Date.now() - f.first > FAIL_WINDOW_MS) failures.set(key, { count: 1, first: Date.now() });
  else f.count++;
};
export const __resetLimiter = () => failures.clear();

const findUserByEmail = async (email) => {
  const rows = await query(
    `SELECT TOP 1 u.UserID AS userId, u.FirstName AS firstName, u.Email AS email
       FROM [dbo].[Users] u
       JOIN [dbo].[UserCredential] c ON c.UserId = u.UserID AND c.IsActive = 1
      WHERE u.IsActive = 1 AND LOWER(LTRIM(RTRIM(u.Email))) = @email
      ORDER BY u.UserID`,
    [{ name: "email", type: sql.NVarChar(320), value: email }]
  );
  return rows[0] || null;
};

export const auth = {
  // Used by sign-up and "add user" to see whether a username is taken. No hash is returned.
  async GET_CREDENTIAL(body) {
    return query(
      `SELECT TOP 1 CAST(1 AS bit) AS [exists], c.UserId AS userId, c.Username AS username
         FROM [dbo].[UserCredential] c
        WHERE c.Username = @username AND c.IsActive = 1`,
      [{ name: "username", type: sql.NVarChar(100), value: String(body.username || "").trim() }]
    );
  },

  async LOGIN(body) {
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const invalid = () => httpError(401, "Invalid username or password.");
    if (!username || !password) throw invalid();

    const rows = await query(
      `SELECT TOP 1 c.UserCredentialId AS credId, c.UserId AS userId, c.Username AS username, c.PasswordHash AS hash,
              c.MustChangePassword AS mustChangePassword, c.FailedLoginAttempts AS fails,
              CASE WHEN c.LockedUntil IS NOT NULL AND c.LockedUntil > SYSUTCDATETIME() THEN 1 ELSE 0 END AS locked,
              u.EmpID AS empId, u.IsActive AS userActive
         FROM [dbo].[UserCredential] c
         LEFT JOIN [dbo].[Users] u ON u.UserID = c.UserId
        WHERE c.Username = @username AND c.IsActive = 1`,
      [{ name: "username", type: sql.NVarChar(100), value: username }]
    );
    const row = rows[0];
    const stored = row ? unwrapHash(row.hash) : "";
    // always run one bcrypt compare so an unknown username takes as long as a wrong password
    const ok = bcrypt.compareSync(password, stored || "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234");
    if (!row || !stored) throw invalid();
    if (row.locked) throw httpError(403, "This account is temporarily locked after too many failed attempts. Try again later or reset your password.");

    if (!ok) {
      await query(
        `UPDATE [dbo].[UserCredential]
            SET FailedLoginAttempts = FailedLoginAttempts + 1,
                LockedUntil = CASE WHEN FailedLoginAttempts + 1 >= ${MAX_FAILS} THEN DATEADD(MINUTE, 15, SYSUTCDATETIME()) ELSE LockedUntil END,
                ModifiedOn = SYSUTCDATETIME()
          WHERE UserCredentialId = @id`,
        [{ name: "id", type: sql.Int, value: row.credId }]
      );
      throw invalid();
    }
    // right password: now make sure the employee record is still active
    if (row.userActive === false) throw httpError(403, "This account is inactive. Contact an admin.");

    await query(
      `UPDATE [dbo].[UserCredential]
          SET FailedLoginAttempts = 0, LockedUntil = NULL, LastLoginOn = SYSUTCDATETIME()
        WHERE UserCredentialId = @id`,
      [{ name: "id", type: sql.Int, value: row.credId }]
    );
    return [{ userId: row.userId, username: row.username, empId: row.empId || "", mustChangePassword: !!row.mustChangePassword }];
  },

  async CREATE_CREDENTIAL(body) {
    const hash = unwrapHash(body.passwordHashB64);
    if (!hash) throw httpError(400, "Invalid password hash.");
    if (!body.userId || !String(body.username || "").trim()) throw httpError(400, "userId and username are required.");
    await query(
      `INSERT INTO [dbo].[UserCredential]
         (UserId, Username, PasswordHash, PasswordAlgorithm, MustChangePassword, FailedLoginAttempts, IsActive, CreatedOn, PasswordChangedOn)
       VALUES (@userId, @username, @hash, 'bcrypt', 0, 0, 1, SYSUTCDATETIME(), SYSUTCDATETIME())`,
      [
        { name: "userId", type: sql.Int, value: Number(body.userId) },
        { name: "username", type: sql.NVarChar(100), value: String(body.username).trim() },
        { name: "hash", type: sql.NVarChar(512), value: hash },
      ]
    );
    return [];
  },

  // Always answers OK, whether or not the email is registered (the screen
  // says "if it's registered, a code is on its way") so it can't be used to
  // discover which emails have accounts.
  async REQUEST_RESET(body) {
    const email = normEmail(body.email);
    if (!email) throw httpError(400, "Email is required.");
    const user = await findUserByEmail(email);
    if (!user) return [];

    const [{ n }] = await query(
      `SELECT COUNT(*) AS n FROM [dbo].[PasswordResetToken] WHERE UserId = @uid AND CreatedOn > DATEADD(HOUR, -1, SYSUTCDATETIME())`,
      [{ name: "uid", type: sql.Int, value: user.userId }]
    );
    if (n >= MAX_REQUESTS_PER_HOUR) return [];

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    await query(
      `UPDATE [dbo].[PasswordResetToken] SET UsedOn = SYSUTCDATETIME() WHERE UserId = @uid AND UsedOn IS NULL;
       INSERT INTO [dbo].[PasswordResetToken] (UserId, Token, ExpiresOn, CreatedOn)
       VALUES (@uid, @token, DATEADD(MINUTE, ${OTP_EXPIRY_MINUTES}, SYSUTCDATETIME()), SYSUTCDATETIME())`,
      [
        { name: "uid", type: sql.Int, value: user.userId },
        { name: "token", type: sql.VarChar(200), value: hashCode(user.userId, code) },
      ]
    );

    await sendMail({
      to: user.email,
      cc: "",
      subject: "ProjectPulse password reset code",
      body: `Hi ${user.firstName || ""},\n\nYour ProjectPulse password reset code is ${code}.\nIt expires in ${OTP_EXPIRY_MINUTES} minutes. If you didn't ask for this, you can ignore this email.`,
    });
    return [];
  },

  async CONFIRM_RESET(body) {
    const email = normEmail(body.email);
    const code = String(body.token || "").trim();
    const hash = unwrapHash(body.passwordHashB64);
    if (!hash) throw httpError(400, "Invalid password hash.");
    if (tooManyFails(email)) throw httpError(429, "Too many incorrect attempts. Please wait 15 minutes and request a new code.");

    const invalid = () => { noteFail(email); return httpError(400, "That code is invalid or expired."); };
    if (!/^\d{6}$/.test(code)) throw invalid();
    const user = await findUserByEmail(email);
    if (!user) throw invalid();

    // Validate the code and change the password in one transaction, with the
    // expiry checked by SQL's own clock.
    const rows = await query(
      `SET XACT_ABORT ON;
       BEGIN TRAN;
       DECLARE @tid INT;
       SELECT TOP 1 @tid = TokenId FROM [dbo].[PasswordResetToken] WITH (UPDLOCK)
        WHERE UserId = @uid AND Token = @token AND UsedOn IS NULL AND ExpiresOn > SYSUTCDATETIME();
       IF @tid IS NULL
       BEGIN
         ROLLBACK;
         SELECT CAST(0 AS BIT) AS ok;
         RETURN;
       END
       UPDATE [dbo].[PasswordResetToken] SET UsedOn = SYSUTCDATETIME() WHERE TokenId = @tid;
       UPDATE [dbo].[UserCredential]
          SET PasswordHash = @hash, PasswordChangedOn = SYSUTCDATETIME(), MustChangePassword = 0,
              FailedLoginAttempts = 0, LockedUntil = NULL, ModifiedOn = SYSUTCDATETIME()
        WHERE UserId = @uid;
       COMMIT;
       SELECT CAST(1 AS BIT) AS ok;`,
      [
        { name: "uid", type: sql.Int, value: user.userId },
        { name: "token", type: sql.VarChar(200), value: hashCode(user.userId, code) },
        { name: "hash", type: sql.NVarChar(512), value: hash },
      ]
    );
    if (!rows[0]?.ok) throw invalid();
    failures.delete(email);
    return [];
  },
};
