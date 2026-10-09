import "dotenv/config";

const bool = (v, def) => (v === undefined || v === "" ? def : String(v).toLowerCase() === "true");
const int = (v, def) => (v === undefined || v === "" ? def : Number.parseInt(v, 10));

export const config = {
  port: int(process.env.PORT, 3001),
  bodyLimit: process.env.BODY_LIMIT || "50mb",
  frontendDist: process.env.FRONTEND_DIST || "",
  // Outgoing mail: the HTTP trigger URL of the old Power Automate mail flow (takes { to, cc, subject, body }).
  // It contains a secret — keep it only in .env. Mail is the only thing sent to a flow.
  mailFlowUrl: process.env.MAIL_FLOW_URL || "",
  db: {
    server: process.env.DB_SERVER || "localhost",
    port: int(process.env.DB_PORT, 1433),
    database: process.env.DB_NAME || "ProjectPulse",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: bool(process.env.DB_ENCRYPT, true),
      trustServerCertificate: bool(process.env.DB_TRUST_SERVER_CERT, true),
    },
    pool: {
      max: int(process.env.DB_POOL_MAX, 20),
      min: int(process.env.DB_POOL_MIN, 2),
      idleTimeoutMillis: 30000,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  },
};
