import { env } from "cloudflare:workers";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { auth } from "./lib/auth";
import { createContext } from "./lib/context";
import { appRouter } from "./routers";
import { aiRoutes } from "./routes/ai";
import { chatRoutes } from "./routes/chat";
import { mcpManagementRoutes } from "./routes/mcp-management";
import { modelsRoutes } from "./routes/models";
import { usageRoutes } from "./routes/usage";
import { userSettingsRoutes } from "./routes/user-settings";

export { UserDurableObject } from "./do/user-durable-object";

const app = new Hono().basePath("/api");

app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN || "http://localhost:3001",
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization", "User-Agent"],
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw));

app.use(
	"/trpc/*",
	trpcServer({
		endpoint: "/api/trpc",
		router: appRouter,
		createContext: (_opts, context) => {
			return createContext({ context });
		},
	}),
);

app.route("/chat", chatRoutes);
app.route("/ai", aiRoutes);
app.route("/models", modelsRoutes);
app.route("/usage", usageRoutes);
app.route("/user/settings", userSettingsRoutes);
app.route("/mcp", mcpManagementRoutes);

app.get("/", (c) => {
	return c.text("OK");
});

export default app;
