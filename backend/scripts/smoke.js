// Offline smoke test: swaps the DB layer for a fake, so we can check the SQL the
// engine generates and the HTTP contract without a SQL Server. Run: npm run test:smoke
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { __setQueryImpl } from "../src/db.js";
import { __setMailer } from "../src/mail.js";
import { __resetLimiter } from "../src/entities/auth.js";
import { createApp } from "../src/server.js";

const calls = [];
let nextError = null;
let responder = null; // (text, params) => rows | undefined
__setQueryImpl(async (text, params = []) => {
  calls.push({ text, params });
  if (nextError) { const e = nextError; nextError = null; throw e; }
  const custom = responder?.(text, params);
  if (custom !== undefined) return custom;
  if (/^SELECT 1/.test(text)) return [{ ok: 1 }];
  if (/^SELECT/.test(text)) return [{ guid: 7, code: "ENG", name: "Engineering", active: true }];
  return [];
});

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const post = (path, body) =>
  fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

let passed = 0;
const check = async (name, fn) => {
  calls.length = 0; responder = null; __setMailer(null); __resetLimiter();
  await fn();
  passed++;
  console.log("  ok -", name);
};

const BCRYPT = "$2a$10$" + "abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234".slice(0, 53); // 60 chars, valid shape
const b64 = (s) => Buffer.from(s).toString("base64");

try {
  /* ---------------- steps 1-2 ---------------- */
  await check("health endpoint reports db up", async () => {
    const r = await fetch(base + "/api/health");
    assert.equal(r.status, 200);
    assert.equal((await r.json()).db, "up");
  });

  await check("LIST returns the flow-shaped array", async () => {
    const r = await post("/flow", { entity: "Department", action: "LIST" });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(await r.json()));
    assert.match(calls[0].text, /SELECT \[DepartmentId\] AS \[guid\], \[DepartmentCode\] AS \[Department Code\], \[DepartmentName\] AS \[Department Name\], \[IsActive\] AS \[Status\] FROM \[dbo\]\.\[Department\] ORDER BY \[DepartmentId\]/);
  });

  await check("CREATE inserts with parameters, then returns the full list", async () => {
    const r = await post("/flow", { entity: "Department", action: "CREATE", code: "ENG'; DROP TABLE Users;--", name: "Engineering", active: true });
    assert.equal(r.status, 200);
    assert.equal(calls.length, 2);
    assert.match(calls[0].text, /^INSERT INTO \[dbo\]\.\[Department\] \(\[DepartmentCode\], \[DepartmentName\], \[IsActive\], \[CreatedOn\]\) VALUES \(@p0, @p1, @p2, SYSUTCDATETIME\(\)\)$/);
    assert.equal(calls[0].params[0].value, "ENG'; DROP TABLE Users;--");
    assert.ok(!calls[0].text.includes("DROP"));
    assert.match(calls[1].text, /^SELECT/);
  });

  await check("EDIT updates by PK and writes NULL for omitted optional fields", async () => {
    await post("/flow2", { entity: "Location", action: "EDIT", guid: 4, code: "BLR", name: "Bengaluru", active: true });
    assert.match(calls[0].text, /^UPDATE \[dbo\]\.\[Location\] SET \[LocationCode\] = @p0, \[LocationName\] = @p1, \[CountryId\] = @p2, \[IsActive\] = @p3, \[ModifiedOn\] = SYSUTCDATETIME\(\) WHERE \[LocationId\] = @guid$/);
    assert.equal(calls[0].params[2].value, null);
    assert.equal(calls[0].params.at(-1).value, 4);
  });

  await check("EDIT/DELETE without guid are rejected before touching SQL", async () => {
    const r = await post("/flow", { entity: "Role", action: "DELETE" });
    assert.equal(r.status, 400);
    assert.equal(calls.length, 0);
  });

  await check("tables with spaced column names and a Guid column are quoted/filled correctly", async () => {
    await post("/flow", { entity: "Role", action: "CREATE", code: "PM", name: "Project Manager", active: true });
    assert.match(calls[0].text, /^INSERT INTO \[dbo\]\.\[Roles\] \(\[Role Code\], \[Role Name\], \[IsActive\]\) VALUES/);
    calls.length = 0;
    await post("/flow", { entity: "ApprovalStatus", action: "CREATE", code: "APP", name: "Approved", active: true });
    assert.match(calls[0].text, /\[Guid\]\) VALUES \(.*NEWID\(\)\)$/);
    assert.match(calls[1].text, /\[Id\] AS \[guid\]/);
  });

  await check("a foreign-key failure comes back as text the frontend's friendlyFlowError understands", async () => {
    nextError = new Error('The DELETE statement conflicted with the REFERENCE constraint "FK_Users_Department". The conflict occurred in database "PP", table "dbo.Users", column \'DepartmentID\'.');
    const r = await post("/flow", { entity: "Department", action: "DELETE", guid: 1 });
    assert.equal(r.status, 500);
    const text = await r.text();
    assert.match(text, /REFERENCE constraint/);
    assert.match(text, /dbo\.Users/);
  });

  await check("unknown entity -> 501, unknown action -> 400, /auditflow -> 501", async () => {
    assert.equal((await post("/flow", { entity: "Nope", action: "LIST" })).status, 501);
    assert.equal((await post("/flow", { entity: "Department", action: "EXPLODE" })).status, 400);
    assert.equal((await post("/auditflow", { to: "a@b.c" })).status, 501);
  });

  await check("inherited JS members can't be reached as entities or actions", async () => {
    for (const entity of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      assert.equal((await post("/flow", { entity, action: "LIST" })).status, 501, entity);
    }
    for (const action of ["constructor", "__proto__", "toString"]) {
      assert.equal((await post("/flow", { entity: "Department", action })).status, 400, action);
    }
    assert.equal(calls.length, 0);
  });

  /* ---------------- Users / UserRoles (needed for sign-in) ---------------- */
  await check("User LIST exposes the misspelled LastNmae column as LastName", async () => {
    await post("/flow", { entity: "User", action: "LIST" });
    assert.match(calls[0].text, /\[LastNmae\] AS \[LastName\]/);
    assert.match(calls[0].text, /\[UserID\] AS \[UserID\]/);
    assert.match(calls[0].text, /FROM \[dbo\]\.\[Users\] ORDER BY \[UserID\]/);
  });

  await check("User CREATE from sign-up (only name/email/active) writes NULL for the rest", async () => {
    await post("/flow", { entity: "User", action: "CREATE", empId: "E015", firstName: "Jane", lastName: "Doe", email: "jane@x.com", active: true });
    assert.match(calls[0].text, /^INSERT INTO \[dbo\]\.\[Users\] \(\[EmpID\], \[FirstName\], \[LastNmae\], \[Gender\], \[JobTitle\], \[DepartmentID\], \[IsActive\], \[Email\], \[ReportingManagerId\], \[LocationId\], \[CreatedOn\]\)/);
    const byName = Object.fromEntries(calls[0].params.map((p, i) => [i, p.value]));
    assert.equal(byName[5], null); // DepartmentID
    assert.equal(byName[8], null); // ReportingManagerId
  });

  await check("UserRoles CREATE fills the Guid column and returns guid/userId/roleId/active", async () => {
    await post("/flow", { entity: "UserRoles", action: "CREATE", userId: 3, roleId: 2, active: true });
    assert.match(calls[0].text, /\[Guid\]\) VALUES \(.*NEWID\(\)\)$/);
    assert.match(calls[1].text, /\[Id\] AS \[guid\], \[UserId\] AS \[userId\], \[RoleId\] AS \[roleId\], \[IsActive\] AS \[active\]/);
  });

  /* ---------------- Auth ---------------- */
  await check("GET_CREDENTIAL only says the username exists — it never returns a hash", async () => {
    responder = () => [{ exists: true, userId: 3, username: "ProjectPulse" }];
    const r = await post("/flow2", { entity: "Auth", action: "GET_CREDENTIAL", username: "ProjectPulse" });
    assert.equal(r.status, 200);
    const [row] = await r.json();
    assert.equal(row.exists, true);
    assert.ok(!("passwordHashB64" in row));
    assert.doesNotMatch(calls[0].text, /PasswordHash/);
    assert.match(calls[0].text, /WHERE c\.Username = @username AND c\.IsActive = 1/);
    assert.equal(calls[0].params[0].value, "ProjectPulse");
  });

  const goodHash = bcrypt.hashSync("Secret#123", 4);
  const credRow = (o = {}) => ({ credId: 5, userId: 3, username: "ProjectPulse", hash: goodHash, mustChangePassword: false, fails: 0, locked: 0, empId: "E001", userActive: true, ...o });

  await check("LOGIN with the right password answers the user and resets the failure counter", async () => {
    responder = (t) => (/^SELECT TOP 1 c\.UserCredentialId/.test(t) ? [credRow()] : undefined);
    const r = await post("/flow2", { entity: "Auth", action: "LOGIN", username: "ProjectPulse", password: "Secret#123" });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), [{ userId: 3, username: "ProjectPulse", empId: "E001", mustChangePassword: false }]);
    assert.match(calls[1].text, /FailedLoginAttempts = 0, LockedUntil = NULL, LastLoginOn = SYSUTCDATETIME\(\)/);
  });

  await check("LOGIN also accepts a hash stored base64-wrapped (as the old flow stored it)", async () => {
    responder = (t) => (/^SELECT TOP 1 c\.UserCredentialId/.test(t) ? [credRow({ hash: b64(goodHash) })] : undefined);
    const r = await post("/flow2", { entity: "Auth", action: "LOGIN", username: "ProjectPulse", password: "Secret#123" });
    assert.equal(r.status, 200);
  });

  await check("LOGIN with a wrong password or unknown user gives the same 401 and counts the failure", async () => {
    responder = (t) => (/^SELECT TOP 1 c\.UserCredentialId/.test(t) ? [credRow()] : undefined);
    const bad = await post("/flow2", { entity: "Auth", action: "LOGIN", username: "ProjectPulse", password: "nope" });
    assert.equal(bad.status, 401);
    const msg = await bad.text();
    assert.match(msg, /Invalid username or password/);
    assert.match(calls[1].text, /FailedLoginAttempts = FailedLoginAttempts \+ 1/);
    assert.match(calls[1].text, /LockedUntil = CASE WHEN FailedLoginAttempts \+ 1 >= 5/);
    calls.length = 0;
    responder = () => [];
    const none = await post("/flow2", { entity: "Auth", action: "LOGIN", username: "ghost", password: "x" });
    assert.equal(none.status, 401);
    assert.equal(await none.text(), msg);
    assert.equal(calls.length, 1, "no UPDATE for an unknown user");
  });

  await check("LOGIN is refused while locked, and for an inactive employee only after the password is right", async () => {
    responder = (t) => (/^SELECT TOP 1 c\.UserCredentialId/.test(t) ? [credRow({ locked: 1 })] : undefined);
    const locked = await post("/flow2", { entity: "Auth", action: "LOGIN", username: "ProjectPulse", password: "Secret#123" });
    assert.equal(locked.status, 403);
    assert.match(await locked.text(), /temporarily locked/);
    responder = (t) => (/^SELECT TOP 1 c\.UserCredentialId/.test(t) ? [credRow({ userActive: false })] : undefined);
    const inactive = await post("/flow2", { entity: "Auth", action: "LOGIN", username: "ProjectPulse", password: "Secret#123" });
    assert.equal(inactive.status, 403);
    assert.match(await inactive.text(), /inactive/);
    assert.equal((await post("/flow2", { entity: "Auth", action: "LOGIN", username: "", password: "" })).status, 401);
  });

  await check("GET_CREDENTIAL for an unknown user returns an empty array", async () => {
    responder = () => [];
    const r = await post("/flow2", { entity: "Auth", action: "GET_CREDENTIAL", username: "nobody" });
    assert.deepEqual(await r.json(), []);
  });

  await check("CREATE_CREDENTIAL unwraps base64 and stores the plain bcrypt text", async () => {
    const r = await post("/flow2", { entity: "Auth", action: "CREATE_CREDENTIAL", userId: 9, username: "jane", passwordHashB64: b64(BCRYPT) });
    assert.equal(r.status, 200);
    assert.match(calls[0].text, /^INSERT INTO \[dbo\]\.\[UserCredential\]/);
    assert.equal(calls[0].params.find((p) => p.name === "hash").value, BCRYPT);
    assert.equal((await post("/flow2", { entity: "Auth", action: "CREATE_CREDENTIAL", userId: 9, username: "jane", passwordHashB64: "not-a-hash" })).status, 400);
  });

  await check("REQUEST_RESET for an unknown email answers OK and sends nothing", async () => {
    let sent = 0;
    __setMailer(async () => { sent++; });
    responder = () => [];
    const r = await post("/flow2", { entity: "Auth", action: "REQUEST_RESET", email: "ghost@x.com" });
    assert.equal(r.status, 200);
    assert.equal(sent, 0);
  });

  let issuedCode = "";
  let storedToken = "";
  await check("REQUEST_RESET stores only a hash of the code and emails the plain 6-digit code", async () => {
    const mails = [];
    __setMailer(async (m) => { mails.push(m); });
    responder = (text) => (/FROM \[dbo\]\.\[Users\]/.test(text) ? [{ userId: 5, firstName: "Jane", email: "jane@x.com" }] : /COUNT/.test(text) ? [{ n: 0 }] : undefined);
    const r = await post("/flow2", { entity: "Auth", action: "REQUEST_RESET", email: " Jane@X.com " });
    assert.equal(r.status, 200);
    assert.equal(mails.length, 1);
    assert.equal(mails[0].to, "jane@x.com");
    issuedCode = mails[0].body.match(/\b(\d{6})\b/)[1];
    const insert = calls.find((c) => /INSERT INTO \[dbo\]\.\[PasswordResetToken\]/.test(c.text));
    storedToken = insert.params.find((p) => p.name === "token").value;
    assert.match(storedToken, /^[0-9a-f]{64}$/);
    assert.notEqual(storedToken, issuedCode);
  });

  await check("REQUEST_RESET is rate-limited per user (no email after 5 in an hour)", async () => {
    let sent = 0;
    __setMailer(async () => { sent++; });
    responder = (text) => (/FROM \[dbo\]\.\[Users\]/.test(text) ? [{ userId: 5, firstName: "J", email: "j@x.com" }] : /COUNT/.test(text) ? [{ n: 5 }] : undefined);
    assert.equal((await post("/flow2", { entity: "Auth", action: "REQUEST_RESET", email: "j@x.com" })).status, 200);
    assert.equal(sent, 0);
  });

  await check("CONFIRM_RESET with a wrong/expired code -> 400 'invalid or expired'", async () => {
    responder = (text) => (/FROM \[dbo\]\.\[Users\]/.test(text) ? [{ userId: 5, firstName: "J", email: "j@x.com" }] : /SELECT CAST\(0 AS BIT\)/.test(text) ? [{ ok: false }] : undefined);
    const r = await post("/flow2", { entity: "Auth", action: "CONFIRM_RESET", email: "j@x.com", token: "123456", passwordHashB64: b64(BCRYPT) });
    assert.equal(r.status, 400);
    assert.match(await r.text(), /invalid or expired/i); // the Forgot Password screen matches this text
  });

  await check("CONFIRM_RESET with the right code updates the password in one transaction", async () => {
    responder = (text) => (/FROM \[dbo\]\.\[Users\]/.test(text) ? [{ userId: 5, firstName: "J", email: "j@x.com" }] : /BEGIN TRAN/.test(text) ? [{ ok: true }] : undefined);
    const r = await post("/flow2", { entity: "Auth", action: "CONFIRM_RESET", email: "j@x.com", token: "123456", passwordHashB64: b64(BCRYPT) });
    assert.equal(r.status, 200);
    const tx = calls.find((c) => /BEGIN TRAN/.test(c.text));
    assert.match(tx.text, /ExpiresOn > SYSUTCDATETIME\(\)/);
    assert.match(tx.text, /UPDATE \[dbo\]\.\[UserCredential\]/);
    assert.equal(tx.params.find((p) => p.name === "hash").value, BCRYPT);
  });

  await check("CONFIRM_RESET locks out code guessing after 5 failures", async () => {
    responder = (text) => (/FROM \[dbo\]\.\[Users\]/.test(text) ? [{ userId: 5, firstName: "J", email: "j@x.com" }] : /SELECT CAST\(0 AS BIT\)/.test(text) ? [{ ok: false }] : undefined);
    const attempt = () => post("/flow2", { entity: "Auth", action: "CONFIRM_RESET", email: "j@x.com", token: "000000", passwordHashB64: b64(BCRYPT) });
    for (let i = 0; i < 5; i++) assert.equal((await attempt()).status, 400);
    const locked = await attempt();
    assert.equal(locked.status, 429);
  });

  /* ---------------- Permission ---------------- */
  await check("LIST_MODULES returns active modules in display order with the keys the app reads", async () => {
    responder = () => [{ moduleId: 1, moduleKey: "dashboard", moduleName: "Dashboard", moduleGroup: "Main", displayOrder: 1 }];
    const r = await post("/flow2", { entity: "Permission", action: "LIST_MODULES" });
    const [m] = await r.json();
    assert.deepEqual(Object.keys(m), ["moduleId", "moduleKey", "moduleName", "moduleGroup", "displayOrder"]);
    assert.match(calls[0].text, /FROM \[dbo\]\.\[Module\] WHERE IsActive = 1 ORDER BY DisplayOrder, ModuleId/);
  });

  await check("LIST_ROLE_PERMISSIONS / LIST_USER_PERMISSIONS select by owner and need an id", async () => {
    await post("/flow2", { entity: "Permission", action: "LIST_ROLE_PERMISSIONS", roleId: 2 });
    assert.match(calls[0].text, /FROM \[dbo\]\.\[RolePermission\] WHERE RoleId = @id AND IsActive = 1/);
    await post("/flow2", { entity: "Permission", action: "LIST_USER_PERMISSIONS", userId: 8 });
    assert.match(calls[1].text, /FROM \[dbo\]\.\[UserPermission\] WHERE UserId = @id AND IsActive = 1/);
    calls.length = 0;
    assert.equal((await post("/flow2", { entity: "Permission", action: "LIST_ROLE_PERMISSIONS" })).status, 400);
    assert.equal(calls.length, 0);
  });

  await check("SAVE_ROLE_PERMISSION upserts with bound flags; SAVE_USER_PERMISSION also sets IsOverride", async () => {
    await post("/flow2", { entity: "Permission", action: "SAVE_ROLE_PERMISSION", roleId: 2, moduleId: 5, canView: true, canEdit: true });
    assert.match(calls[0].text, /UPDATE \[dbo\]\.\[RolePermission\] WITH \(UPDLOCK, SERIALIZABLE\)[\s\S]*IF @@ROWCOUNT = 0[\s\S]*INSERT INTO \[dbo\]\.\[RolePermission\]/);
    const flags = Object.fromEntries(calls[0].params.filter((p) => p.name.startsWith("can")).map((p) => [p.name, p.value]));
    assert.deepEqual(flags, { canView: true, canCreate: false, canEdit: true, canDelete: false, canApprove: false });
    calls.length = 0;
    await post("/flow2", { entity: "Permission", action: "SAVE_USER_PERMISSION", userId: 8, moduleId: 5, canView: false });
    assert.match(calls[0].text, /IsOverride = 1/);
    assert.match(calls[0].text, /INSERT INTO \[dbo\]\.\[UserPermission\] \(UserId, ModuleId, CanView, CanCreate, CanEdit, CanDelete, CanApprove, IsActive, IsOverride, CreatedOn\)/);
  });

  await check("CLEAR_USER_PERMISSION deletes just that user's override for that module", async () => {
    await post("/flow2", { entity: "Permission", action: "CLEAR_USER_PERMISSION", userId: 8, moduleId: 5 });
    assert.match(calls[0].text, /^DELETE FROM \[dbo\]\.\[UserPermission\] WHERE UserId = @id AND ModuleId = @moduleId$/);
  });


  /* ---------------- admin + project screens ---------------- */
  const sqlOf = () => calls[0].text;
  const pnames = () => calls[0].params.map((p) => p.name);

  await check("Project CREATE leaves DealStatusId out; EDIT writes it", async () => {
    await post("/flow", { entity: "Project", action: "CREATE", projectCode: "P1", projectName: "X", dealStatusId: 3, startDate: "2026-01-05" });
    assert.doesNotMatch(sqlOf(), /INSERT[^;]*DealStatusId/);
    calls.length = 0;
    await post("/flow", { entity: "Project", action: "EDIT", guid: 4, projectName: "X", dealStatusId: 3 });
    assert.match(sqlOf(), /UPDATE \[dbo\]\.\[Project\] SET[\s\S]*\[DealStatusId\] = @p\d+/);
  });

  await check("Project LIST returns dates as YYYY-MM-DDT00:00:00 and text fields blank for NULL", async () => {
    await post("/flow", { entity: "Project", action: "LIST" });
    assert.match(sqlOf(), /CONVERT\(varchar\(10\), \[StartDate\], 23\) \+ 'T00:00:00'/);
    assert.match(sqlOf(), /ISNULL\(CAST\(\[Geography\] AS NVARCHAR\(MAX\)\), N''\)/);
  });

  await check("Client and ClientContacts map to their tables and column names", async () => {
    await post("/flow", { entity: "Client", action: "CREATE", clientCode: "C1", clientName: "Acme", countryId: 1, active: true });
    assert.match(sqlOf(), /INSERT INTO \[dbo\]\.\[Client\]/);
    calls.length = 0;
    await post("/flow", { entity: "ClientContacts", action: "CREATE", clientId: 1, contactName: "A", contactEmail: "a@x.com", contactPhone: "1", active: true });
    assert.match(sqlOf(), /INSERT INTO \[dbo\]\.\[ClientContact\][\s\S]*Email[\s\S]*Phone/);
  });

  await check("Holiday date is bound as a date and LocationId may be absent", async () => {
    await post("/flow", { entity: "Holiday", action: "CREATE", holidayDate: "2026-12-25", holidayName: "Xmas", active: true });
    assert.match(sqlOf(), /CONVERT\(date, @p\d+, 23\)/);
    assert.ok(calls[0].params.some((x) => x.value === "2026-12-25"), "date bound as text");
    assert.ok(calls[0].params.some((x) => x.value === null), "LocationId is NULL");
  });

  await check("ProjectResourceTxn EDIT writes EndDate as a date (flow typo fixed)", async () => {
    await post("/flow", { entity: "ProjectResourceTxn", action: "EDIT", guid: 2, endDate: "2026-03-31" });
    assert.match(sqlOf(), /\[EndDate\] = (CONVERT\(date, )?@p\d+/);
  });

  await check("ProjectApproval CREATE vs EDIT write different columns", async () => {
    await post("/flow", { entity: "ProjectApproval", action: "CREATE", projectId: 1, cpPercent: 12.5, requestedByUserId: 3, approvalStatusId: 1, active: true });
    assert.doesNotMatch(sqlOf(), /INSERT[^;]*(Comments|DecidedOn)/);
    calls.length = 0;
    await post("/flow", { entity: "ProjectApproval", action: "EDIT", guid: 9, approvalStatusId: 2, comments: "ok", decidedByUserId: 5, decidedOn: "2026-10-08T10:00:00Z", active: true });
    assert.match(sqlOf(), /Comments/);
    assert.doesNotMatch(sqlOf(), /SET[^;]*CPPercent/);
  });

  await check("AuditLog CREATE answers [] and EDIT is rejected", async () => {
    const r = await post("/flow2", { entity: "AuditLog", action: "CREATE", screenName: "S", auditAction: "A", recordName: "R", byUser: "u" });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), []);
    assert.equal(calls.length, 1);
    assert.equal((await post("/flow2", { entity: "AuditLog", action: "EDIT", guid: 1 })).status, 400);
  });

  await check("ProjectDocument stores base64 as a Buffer; ProjectDocumentFile works without an action", async () => {
    await post("/flow2", { entity: "ProjectDocument", action: "CREATE", projectId: 1, docName: "d", docType: "pdf", uploadedByUserId: 2, uploadDate: "2026-10-08", active: true, fileName: "a.txt", fileData: b64("hello") });
    const fd = calls[0].params.find((x) => Buffer.isBuffer(x.value));
    assert.ok(fd && fd.value.toString() === "hello", "file bound as Buffer");
    calls.length = 0;
    responder = () => [{ ProjectDocumentId: 5, DocName: "d", DocType: "pdf", FileName: "a.txt", FileData: Buffer.from("hello") }];
    const r = await post("/flow2", { entity: "ProjectDocumentFile", guid: 5 });
    const j = await r.json();
    assert.equal(j[0].fileData, b64("hello"));
    assert.equal(j[0].guid, "5");
  });


  /* ---------------- finance, notification log, email ---------------- */
  await check("Billing CREATE always inserts ApprovalStatusId 6; EDIT writes the caller's value", async () => {
    await post("/flow2", { entity: "Billing", action: "CREATE", projectId: 1, billingTypeId: 2, amount: 100, approvalStatusId: 3, active: true, submittedByUserId: 4 });
    assert.match(sqlOf(), /INSERT INTO \[dbo\]\.\[Billing\][^;]*\[ApprovalStatusId\]/);
    const six = calls[0].params.filter((x) => x.value === 6);
    assert.equal(six.length, 1, "constant 6 bound once");
    assert.ok(!calls[0].params.some((x) => x.value === 3), "caller's 3 ignored on CREATE");
    calls.length = 0;
    await post("/flow2", { entity: "Billing", action: "EDIT", guid: 9, approvalStatusId: 3, approvedByUserId: 5, approvedOn: "2026-10-08T10:00:00Z", remarks: "ok" });
    assert.ok(calls[0].params.some((x) => x.value === 3));
    assert.doesNotMatch(sqlOf(), /SubmittedByUserId/);
    assert.match(sqlOf(), /\[ModifiedOn\] = SYSUTCDATETIME\(\)/);
  });

  await check("Invoice answers as text for blank-safe fields; payment columns are EDIT-only", async () => {
    await post("/flow2", { entity: "Invoice", action: "LIST" });
    assert.match(sqlOf(), /ISNULL\(FORMAT\(\[Amount\]/);
    assert.match(sqlOf(), /ISNULL\(CONVERT\(varchar\(10\), \[DueDate\], 23\) \+ 'T00:00:00', N''\) AS \[dueDate\]/);
    calls.length = 0;
    await post("/flow2", { entity: "Invoice", action: "CREATE", invoiceNumber: "INV1", clientId: 1, amount: 5, paymentReference: "X", active: true });
    assert.doesNotMatch(sqlOf(), /INSERT[^;]*(PaymentReference|PaymentDate)/);
    calls.length = 0;
    await post("/flow2", { entity: "Invoice", action: "EDIT", guid: 3, invoiceNumber: "INV1", paymentReference: "X" });
    assert.match(sqlOf(), /\[PaymentReference\] = @p\d+/);
  });

  await check("Timesheet CREATE sets the key columns; EDIT only changes hours/status/approval", async () => {
    await post("/flow2", { entity: "Timesheet", action: "CREATE", employeeUserId: 1, projectId: 2, weekEnding: "2026-10-04", hours: 40, status: "Submitted", billingPeriodId: 3 });
    assert.match(sqlOf(), /INSERT INTO \[dbo\]\.\[Timesheet\][^;]*\[EmployeeUserID\][^;]*\[CreatedOn\], \[ModifiedOn\]/);
    calls.length = 0;
    await post("/flow2", { entity: "Timesheet", action: "EDIT", guid: 7, hours: 38, status: "Approved", approvalStatusId: 2, approvedByUserId: 9, approvedOn: "2026-10-08T10:00:00Z" });
    assert.doesNotMatch(sqlOf(), /EmployeeUserID|WeekEnding|BillingPeriodId/);
    assert.match(sqlOf(), /\[Hours\] = @p\d+, \[Status\] = @p\d+/);
  });

  await check("BillingPeriod and BillingResource map to their tables", async () => {
    await post("/flow2", { entity: "BillingPeriod", action: "CREATE", billingMonth: 10, billingYear: 2026, periodName: "Oct 2026", periodStartDate: "2026-10-01", periodEndDate: "2026-10-31", isClosed: false, active: true });
    assert.match(sqlOf(), /INSERT INTO \[dbo\]\.\[BillingPeriod\]/);
    assert.doesNotMatch(sqlOf(), /ModifiedOn/);
    calls.length = 0;
    await post("/flow2", { entity: "BillingResource", action: "EDIT", guid: 2, billingId: 9, userId: 9, hoursPerDay: 8, workingDays: 20, plannedHours: 160, actualHours: 150, active: true });
    assert.doesNotMatch(sqlOf(), /SET[^W]*\[BillingId\]|SET[^W]*\[UserId\]/);
  });

  await check("NotificationLog: CREATE inserts one row with SentDate in UTC and answers []; EDIT/DELETE are refused", async () => {
    const r = await post("/flow2", { entity: "NotificationLog", action: "CREATE", emailType: "Audit", recipientEmail: "a@x.com", subjectLine: "s", deliveryStatus: "Sent", sentBy: "u" });
    assert.deepEqual(await r.json(), []);
    assert.equal(calls.length, 1);
    assert.match(sqlOf(), /INSERT INTO \[dbo\]\.\[NotificationLog\][^;]*\[SentDate\]\) VALUES \([^;]*SYSUTCDATETIME\(\)\)/);
    assert.equal((await post("/flow2", { entity: "NotificationLog", action: "DELETE", guid: 1 })).status, 400);
    assert.equal((await post("/flow2", { entity: "NotificationLog", action: "LIST" })).status, 200);
  });

  await check("/auditflow sends through the mailer and answers 2xx; a mailer failure answers non-2xx with the reason", async () => {
    const sent = [];
    __setMailer(async (m) => { sent.push(m); });
    const ok = await post("/auditflow", { to: "a@x.com", cc: "b@x.com", subject: "S", body: "<p>hi</p>" });
    assert.equal(ok.status, 200);
    assert.deepEqual(sent[0], { to: "a@x.com", cc: "b@x.com", subject: "S", body: "<p>hi</p>" });
    __setMailer(async () => { const e = new Error("Email could not be sent: boom"); e.status = 502; throw e; });
    const bad = await post("/auditflow", { to: "a@x.com", subject: "S", body: "x" });
    assert.equal(bad.status, 502);
    assert.match(await bad.text(), /boom/);
  });

  await check("with no MAIL_FLOW_URL /auditflow answers 501 (so the frontend logs 'Failed')", async () => {
    const r = await post("/auditflow", { to: "a@x.com", subject: "S", body: "x" });
    assert.equal(r.status, 501);
    assert.match(await r.text(), /not configured/);
  });


  await check("MAIL_FLOW_URL: mail is forwarded to the old flow as {to,cc,subject,body}; flow failures become 502", async () => {
    const { config } = await import("../src/config.js");
    const http = await import("node:http");
    const got = [];
    let status = 202;
    const fake = http.createServer((rq, rs) => { let b = ""; rq.on("data", (c) => (b += c)); rq.on("end", () => { got.push(JSON.parse(b)); rs.statusCode = status; rs.end(status < 300 ? "" : "boom"); }); }).listen(0);
    config.mailFlowUrl = `http://127.0.0.1:${fake.address().port}/hook?sig=abc`;
    __setMailer(null); // rebuild the default sender from the config
    try {
      const ok = await post("/auditflow", { to: "a@x.com", cc: "b@x.com", subject: "S", body: "<p>x</p>" });
      assert.equal(ok.status, 200);
      assert.deepEqual(got[0], { to: "a@x.com", cc: "b@x.com", subject: "S", body: "<p>x</p>" });
      status = 500;
      const bad = await post("/auditflow", { to: "a@x.com", subject: "S", body: "x" });
      assert.equal(bad.status, 502);
      assert.match(await bad.text(), /mail flow answered 500/);
      assert.ok(!(await (await post("/auditflow", { to: "a@x.com", subject: "S", body: "x" })).text()).includes("sig=abc"), "secret URL never echoed");
      // a flow that cannot be reached: still no secret in the message
      config.mailFlowUrl = "http://127.0.0.1:1/hook?sig=abc"; __setMailer(null);
      const down = await post("/auditflow", { to: "a@x.com", subject: "S", body: "x" });
      assert.equal(down.status, 502);
      assert.ok(!(await down.text()).includes("sig=abc"));
    } finally {
      config.mailFlowUrl = ""; __setMailer(null); fake.close();
    }
  });

  console.log(`\n${passed} checks passed`);
} finally {
  server.close();
}
