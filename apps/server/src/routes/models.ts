import { Hono } from "hono";
import { requireUserDO, UnauthorizedError } from "@/server/lib/guard";
import {
	getUserAvailableModels,
	loadModelsDevCatalog,
} from "@/server/lib/providers";

export const modelsRoutes = new Hono();

// Get available models based on user's API keys
modelsRoutes.get("/available", async (c) => {
	try {
		const { stub } = await requireUserDO(c);
		const userSettings = await stub.getUserSettings();
		const availableModels = await getUserAvailableModels(userSettings.apiKeys);

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
		const catalog = await loadModelsDevCatalog();
		return c.json(catalog);
	} catch (err) {
		if (err instanceof UnauthorizedError) {
			return c.json({ error: "Authentication required" }, 401);
		}
		throw err;
	}
});
