import { Hono } from "hono";
import { z } from "zod";
import { requireUserDO, UnauthorizedError } from "@/server/lib/guard";
import { BUILT_IN_MCP_SERVERS } from "@/server/mcp/client";

const addMCPServerSchema = z.object({
	name: z.string().min(1).max(100),
	url: z.string().url(),
	type: z.enum(["http", "sse"]),
	description: z.string().optional(),
	headers: z.record(z.string(), z.string()).optional(),
});

export const mcpManagementRoutes = new Hono();

// Get all MCP servers (built-in + user's custom)
mcpManagementRoutes.get("/servers", async (c) => {
	try {
		const { stub } = await requireUserDO(c);
		const userSettings = await stub.getUserSettings();
		const customServers = await stub.getCustomMCPServers();
		const enabledBuiltInIds = userSettings.enabledMcpServers || [];

		// Combine built-in and custom servers with enabled status
		const allServers = [
			...BUILT_IN_MCP_SERVERS.map((server) => ({
				...server,
				enabled: enabledBuiltInIds.includes(server.id),
			})),
			...customServers.map((server) => ({
				...server,
				isBuiltIn: false,
			})),
		];

		return c.json(allServers);
	} catch (err) {
		if (err instanceof UnauthorizedError) {
			return c.json({ error: "Authentication required" }, 401);
		}
		throw err;
	}
});

// Add custom MCP server
mcpManagementRoutes.post("/servers", async (c) => {
	try {
		const { stub } = await requireUserDO(c);
		const body = addMCPServerSchema.parse(await c.req.json());

		const serverId = `custom_${Date.now()}`;

		await stub.addCustomMCPServer({
			id: serverId,
			name: body.name,
			url: body.url,
			type: body.type,
			description: body.description,
			headers: body.headers,
			enabled: true,
			created: new Date(),
		});

		const newServer = {
			id: serverId,
			...body,
			isBuiltIn: false,
			enabled: true,
		};

		return c.json(newServer, 201);
	} catch (err) {
		if (err instanceof UnauthorizedError) {
			return c.json({ error: "Authentication required" }, 401);
		}
		if (err instanceof z.ZodError) {
			return c.json({ error: "Invalid input", details: err.issues }, 400);
		}
		throw err;
	}
});

// Toggle MCP server enabled/disabled
mcpManagementRoutes.put("/servers/:serverId/toggle", async (c) => {
	try {
		const { stub } = await requireUserDO(c);
		const serverId = c.req.param("serverId");
		const { enabled } = z
			.object({ enabled: z.boolean() })
			.parse(await c.req.json());

		if (serverId.startsWith("custom_")) {
			// Toggle custom server
			await stub.toggleCustomMCPServer(serverId, enabled);
		} else {
			// Toggle built-in server in user settings
			const settings = await stub.getUserSettings();
			let enabledServers = settings.enabledMcpServers || [];

			if (enabled) {
				if (!enabledServers.includes(serverId)) {
					enabledServers.push(serverId);
				}
			} else {
				enabledServers = enabledServers.filter((id) => id !== serverId);
			}

			await stub.updateUserSettings({ enabledMcpServers: enabledServers });
		}

		return c.json({ success: true });
	} catch (err) {
		if (err instanceof UnauthorizedError) {
			return c.json({ error: "Authentication required" }, 401);
		}
		throw err;
	}
});

// Remove custom MCP server
mcpManagementRoutes.delete("/servers/:serverId", async (c) => {
	try {
		const { stub } = await requireUserDO(c);
		const serverId = c.req.param("serverId");

		// Prevent deletion of built-in servers
		const builtInServer = BUILT_IN_MCP_SERVERS.find((s) => s.id === serverId);
		if (builtInServer) {
			return c.json({ error: "Cannot delete built-in servers" }, 400);
		}

		await stub.removeCustomMCPServer(serverId);

		return c.json({ success: true });
	} catch (err) {
		if (err instanceof UnauthorizedError) {
			return c.json({ error: "Authentication required" }, 401);
		}
		throw err;
	}
});
