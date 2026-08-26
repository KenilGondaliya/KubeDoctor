import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import healthRouter from "./routes/health.routes.js";

const app = express();

app.disable("x-powered-by");

app.use(
  helmet()
);

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 100
  })
);

app.get("/", (req, res) => {
  res.json({
    service: "kubedoctor-api",
    version: "0.1.0",
    status: "running"
  });
});

app.use("/api/v1", healthRouter);

export default app;