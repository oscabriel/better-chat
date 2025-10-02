import { Hono } from "hono";
import { z } from "zod";
import { requireUserDO, UnauthorizedError } from "@/server/lib/guard";

const listMessagesQuerySchema = z.object({
	conversationId: z.string().min(1, "conversationId is required"),
	limit: z.coerce.number().int().positive().max(200).optional(),
	cursor: z.coerce.number().int().optional(),
});

const upsertConversationSchema = z.object({
	title: z.string().max(80).optional().nullable(),
});

export const chatRoutes = new Hono();

chatRoutes.get("/conversations", async (c) => {
	try {
		const { stub } = await requireUserDO(c);
		const conversations = await stub.listConversations();
		return c.json({ items: conversations });
	} catch (err) {
		if (err instanceof UnauthorizedError)
			return c.json({ error: err.message }, 401);
		throw err;
	}
});

chatRoutes.get("/messages", async (c) => {
	const query = listMessagesQuerySchema.safeParse({
		conversationId: c.req.query("conversationId"),
		limit: c.req.query("limit"),
		cursor: c.req.query("cursor"),
	});

	if (!query.success) {
		return c.json(
			{
				error: "Invalid request",
				details: query.error.flatten().fieldErrors,
			},
			400,
		);
	}

	try {
		const { stub } = await requireUserDO(c);
		const { conversationId, limit, cursor } = query.data;
		const result = await stub.listMessages(conversationId, limit, cursor);
		return c.json(result);
	} catch (err) {
		if (err instanceof UnauthorizedError)
			return c.json({ error: err.message }, 401);
		throw err;
	}
});

// Fetch a single conversation by ID
chatRoutes.get("/conversations/:conversationId", async (c) => {
	try {
		const { stub } = await requireUserDO(c);
		const conversationId = c.req.param("conversationId");
		if (!conversationId) {
			return c.json({ error: "conversationId is required" }, 400);
		}
		// Auto-create conversation if it doesn't exist to prevent race condition
		// where frontend loads conversation before first message is sent
		let conversation = await stub.getConversation(conversationId);
		if (!conversation) {
			await stub.upsertConversation(conversationId);
			conversation = await stub.getConversation(conversationId);
		}
		if (!conversation) {
			return c.json({ error: "Not found" }, 404);
		}
		return c.json(conversation);
	} catch (err) {
		if (err instanceof UnauthorizedError)
			return c.json({ error: err.message }, 401);
		throw err;
	}
});

// Fetch messages by conversation ID (path variant)
chatRoutes.get("/conversations/:conversationId/messages", async (c) => {
	try {
		const { stub } = await requireUserDO(c);
		const conversationId = c.req.param("conversationId");
		if (!conversationId) {
			return c.json({ error: "conversationId is required" }, 400);
		}
		const limit = Number(c.req.query("limit") ?? 100);
		const cursor = c.req.query("cursor");
		const parsedCursor = cursor ? Number(cursor) : undefined;
		const result = await stub.listMessages(conversationId, limit, parsedCursor);
		return c.json(result);
	} catch (err) {
		if (err instanceof UnauthorizedError)
			return c.json({ error: err.message }, 401);
		throw err;
	}
});

chatRoutes.get("/debug/conversations/:conversationId", async (c) => {
	try {
		const { stub } = await requireUserDO(c);
		const conversationId = c.req.param("conversationId");
		if (!conversationId) {
			return c.json({ error: "conversationId is required" }, 400);
		}
		const conversations = await stub.listConversations();
		const conversation =
			conversations.find((item) => item.id === conversationId) ?? null;
		const messages = await stub.listMessages(conversationId, 200);
		return c.json({ conversation, messages });
	} catch (err) {
		if (err instanceof UnauthorizedError)
			return c.json({ error: err.message }, 401);
		throw err;
	}
});

chatRoutes.get("/debug/user", async (c) => {
	try {
		const { userId, stub } = await requireUserDO(c);
		const conversations = await stub.listConversations();
		const messagesByConversation = await Promise.all(
			conversations.map(async (conversation) => {
				const messages = await stub.listMessages(conversation.id, 500);
				return { conversation, messages };
			}),
		);
		return c.json({ userId, conversations, messagesByConversation });
	} catch (err) {
		if (err instanceof UnauthorizedError)
			return c.json({ error: err.message }, 401);
		throw err;
	}
});

chatRoutes.put("/conversations/:conversationId", async (c) => {
	try {
		const { stub } = await requireUserDO(c);
		const conversationId = c.req.param("conversationId");
		if (!conversationId) {
			return c.json({ error: "conversationId is required" }, 400);
		}

		const body = upsertConversationSchema.safeParse(
			await c.req.json().catch(() => ({})),
		);
		if (!body.success) {
			return c.json(
				{
					error: "Invalid request",
					details: body.error.flatten().fieldErrors,
				},
				400,
			);
		}

		const result = await stub.upsertConversation(
			conversationId,
			body.data.title ?? null,
		);
		return c.json(result);
	} catch (err) {
		if (err instanceof UnauthorizedError)
			return c.json({ error: err.message }, 401);
		throw err;
	}
});

chatRoutes.delete("/conversations/:conversationId", async (c) => {
	try {
		const { stub } = await requireUserDO(c);
		const conversationId = c.req.param("conversationId");
		if (!conversationId) {
			return c.json({ error: "conversationId is required" }, 400);
		}
		return c.json(await stub.deleteConversation(conversationId));
	} catch (err) {
		if (err instanceof UnauthorizedError)
			return c.json({ error: err.message }, 401);
		throw err;
	}
});
