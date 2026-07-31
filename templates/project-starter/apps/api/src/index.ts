import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { healthRouter } from "./routes/health.js";
import { apiRouter } from "./routes/api.js";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.route("/health", healthRouter);
app.route("/api", apiRouter);

const port = parseInt(process.env.PORT ?? "3001", 10);

export default {
  port,
  fetch: app.fetch,
};
