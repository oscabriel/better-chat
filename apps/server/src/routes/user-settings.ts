import { Hono } from "hono";
import { z } from "zod";
import { requireUserDO, UnauthorizedError } from "@/server/lib/guard";

const updateSettingsSchema = z.object({
	selectedModel: z.string().optional(),
	apiKeys: z.record(z.string(), z.string()).optional(),
	enabledModels: z.array(z.string()).optional(),
	enabledMcpServers: z.array(z.string()).optional(),
	theme: z.string().optional(),
	chatWidth: z.string().optional(),
});

export const userSettingsRoutes = new Hono();

// Get user settings
userSettingsRoutes.get("/", async (c) => {
	try {
		const { stub } = await requireUserDO(c);
		const settings = await stub.getUserSettings();
		return c.json(settings);
	} catch (err) {
		if (err instanceof UnauthorizedError) {
			return c.json({ error: "Authentication required" }, 401);
		}
		throw err;
	}
});

// Update user settings
userSettingsRoutes.put("/", async (c) => {
	try {
		const { stub } = await requireUserDO(c);
		const body = updateSettingsSchema.parse(await c.req.json());

		await stub.updateUserSettings(body);
		const updated = await stub.getUserSettings();

		return c.json(updated);
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
