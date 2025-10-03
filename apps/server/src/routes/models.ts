import { Hono } from "hono";
import { requireUserId, UnauthorizedError } from "@/server/lib/guard";
import {
	getModelCatalog,
	getUserAvailableModels,
} from "@/server/lib/providers";
import { getUserSettingsRecord } from "@/server/lib/user-settings";

export const modelsRoutes = new Hono();

// Get available models based on user's API keys
modelsRoutes.get("/available", async (c) => {
	try {
		const userId = await requireUserId(c);
		const userSettings = await getUserSettingsRecord(userId);
		const availableModels = getUserAvailableModels(userSettings.apiKeys);

		return c.json(availableModels);
	} catch (err) {
		if (err instanceof UnauthorizedError) {
			return c.json({ error: "Authentication required" }, 401);
		}
		throw err;
	}
});

// Get all models (for reference)
modelsRoutes.get("/all", async (c) => {
	try {
		const catalog = getModelCatalog();
		return c.json(catalog);
	} catch (err) {
		if (err instanceof UnauthorizedError) {
			return c.json({ error: "Authentication required" }, 401);
		}
		throw err;
	}
});
