// api/health/version.js
import express from "express";

const router = express.Router();

const VERSION_INFO = {
  buildTag: "SOUNDYAI_2025_12_18_B",
  gitSha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "local-dev",
  entrypoint: "work/server.js",
  jobsHandlerPath: "work/api/jobs/[id].js",
  architecture: "redis-workers",
  nodeVersion: process.version,
  platform: process.platform,
  uptime: null, // será calculado dinamicamente
  startTime: Date.now()
};

router.get("/", (req, res) => {
  res.json({
    ...VERSION_INFO,
    uptime: Math.floor((Date.now() - VERSION_INFO.startTime) / 1000),
    timestamp: new Date().toISOString(),
    pid: process.pid,
    cwd: process.cwd()
  });
});

export default router;
