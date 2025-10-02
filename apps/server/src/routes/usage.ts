import { Hono } from "hono";
import { requireUserId, UnauthorizedError } from "@/server/lib/guard";
import {
	getCurrentUsageSummary,
	getUsageStats,
} from "@/server/utils/usage-service";

export const usageRoutes = new Hono();

// Get current usage and limits (default limits for non-BYOK users)
usageRoutes.get("/current", async (c) => {
	try {
		const userId = await requireUserId(c);
		const usage = await getCurrentUsageSummary(userId);
		return c.json(usage);
	} catch (err) {
		if (err instanceof UnauthorizedError) {
			return c.json({ error: "Authentication required" }, 401);
		}
		throw err;
	}
});

// Get usage statistics for a date range
usageRoutes.get("/stats", async (c) => {
	try {
		const userId = await requireUserId(c);
		const startDate = c.req.query("startDate");
		const endDate = c.req.query("endDate");

		const stats = await getUsageStats(userId, startDate, endDate);
		return c.json(stats);
	} catch (err) {
		if (err instanceof UnauthorizedError) {
			return c.json({ error: "Authentication required" }, 401);
		}
		throw err;
	}
});
