import express from "express";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "./config.js";
import { ping, closePool } from "./db.js";
import flowRoutes from "./routes/flow.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: config.bodyLimit }));

  app.get("/api/health", async (req, res) => {
    try {
      await ping();
      res.json({ status: "ok", db: "up", uptimeSec: Math.round(process.uptime()) });
    } catch (err) {
      res.status(503).json({ status: "degraded", db: "down", error: err.message });
    }
  });

  app.use(flowRoutes);

  // Optionally serve the built frontend from this same server, so the app and
  // API share one origin (no CORS, one thing to host). Set FRONTEND_DIST.
  if (config.frontendDist && fs.existsSync(config.frontendDist)) {
    const dist = path.resolve(config.frontendDist);
    app.use(express.static(dist));
    app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  // Errors go back as plain text with the real SQL message. The frontend's
  // friendlyFlowError() already turns FK / UNIQUE violations into readable
  // messages by pattern-matching that text, exactly as it did for the flows.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return res.status(400).type("text/plain").send("Invalid JSON body.");
    if (err.type === "entity.too.large") return res.status(413).type("text/plain").send("Request body too large.");
    res.status(err.status || 500).type("text/plain").send(err.message || "Internal error");
  });

  return app;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const app = createApp();
  const server = app.listen(config.port, () => console.log(`ProjectPulse API listening on :${config.port}`));
  const shutdown = async () => {
    server.close();
    await closePool();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
