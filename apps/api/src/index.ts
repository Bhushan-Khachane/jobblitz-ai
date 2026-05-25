import { Hono } from "hono";
import { cors } from "hono/cors";
import { validateAtStartup } from "@jobblitz/security";
import { auth } from "./auth";
import { loggerMiddleware } from "./middleware/logger";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { routers } from "./routers";

validateAtStartup();

const app = new Hono();

app.use(cors({
  origin: [process.env.WEB_URL || "http://localhost:3000"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(loggerMiddleware);
app.use(rateLimitMiddleware);

// Better Auth handler
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

// Health check (public)
app.route("/api/health", routers.health);

// Protected routes
app.route("/api/jobs", routers.jobs);
app.route("/api/applications", routers.applications);
app.route("/api/approvals", routers.approvals);
app.route("/api/resumes", routers.resumes);
app.route("/api/research", routers.research);
app.route("/api/users", routers.users);
app.route("/api/dashboard", routers.dashboard);
app.route("/api/memory", routers.memory);

app.onError(errorHandler);
app.notFound(notFoundHandler);

const port = Number(process.env.PORT) || 8000;
console.log(`[api] starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
