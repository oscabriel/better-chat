import { Hono } from "hono";
import { createSessionCookie, readSession } from "./auth";
import { NoteAgent } from "./note-agent";

export { NoteAgent };

export interface Bindings {
	DB: D1Database;
	NOTE_AGENT: DurableObjectNamespace;
	SESSION_SECRET: string;
	DEV_LOGIN?: string;
	ASSETS: Fetcher;
}

interface Session {
	userId: string;
}

const MAX_CAPTURE_LENGTH = 100_000;
const PREVIEW_LENGTH = 120;

type Env = { Bindings: Bindings; Variables: { session: Session } };
const app = new Hono<Env>();

// Dev-only session minting. Disabled unless DEV_LOGIN=1 (local wrangler dev).
// The real auth provider is an open proposal decision and replaces this route.
// Registered before the auth middleware so it is reachable without a session.
app.get("/api/dev/login", async (c) => {
	if (c.env.DEV_LOGIN !== "1") {
		return c.json({ error: "disabled" }, 403);
	}
	const userId = c.req.query("u") ?? "demo-user";
	const cookie = await createSessionCookie(c.env.SESSION_SECRET, userId);
	c.header("Set-Cookie", cookie);
	return c.json({ userId });
});

app.use("/api/*", async (c, next) => {
	const user = await readSession(c.env.SESSION_SECRET, c.req.header("Cookie") ?? null);
	if (!user) {
		return c.json({ error: "unauthenticated" }, 401);
	}
	c.set("session", { userId: user.id });
	await next();
});

app.post("/api/capture", async (c) => {
	const { userId } = c.get("session");

	let body: { text?: unknown };
	try {
		body = (await c.req.json()) as { text?: unknown };
	} catch {
		return c.json({ error: "invalid json" }, 400);
	}
	if (typeof body.text !== "string" || body.text.trim().length === 0) {
		return c.json({ error: "capture text required" }, 400);
	}
	const text = body.text.slice(0, MAX_CAPTURE_LENGTH);
	// Messy input is accepted by design: no validation beyond non-empty.

	const noteId = crypto.randomUUID();
	const now = Date.now();
	const preview = text.slice(0, PREVIEW_LENGTH);

	await c.env.DB.prepare(
		"INSERT INTO notes (id, user_id, title, state, preview, created_at, updated_at) VALUES (?, ?, NULL, 'active', ?, ?, ?)",
	)
		.bind(noteId, userId, preview, now, now)
		.run();

	// Forward to the note's NoteAgent; D1 is directory metadata only.
	const stub = c.env.NOTE_AGENT.get(c.env.NOTE_AGENT.idFromName(noteId));
	const doRes = await stub.fetch("https://note-agent/captures", {
		method: "POST",
		body: JSON.stringify({ id: noteId, content: text }),
	});
	if (!doRes.ok) {
		return c.json({ error: "capture persistence failed" }, 500);
	}

	return c.json({ id: noteId, saved: true }, 201);
});

app.get("/api/notes/:id", async (c) => {
	const { userId } = c.get("session");

	const row = await c.env.DB.prepare(
		"SELECT id, user_id, state, preview FROM notes WHERE id = ?",
	)
		.bind(c.req.param("id"))
		.first<{ id: string; user_id: string; state: string; preview: string }>();
	if (!row || row.user_id !== userId) {
		// A guessed note identifier must not grant access.
		return c.json({ error: "not found" }, 404);
	}

	const stub = c.env.NOTE_AGENT.get(c.env.NOTE_AGENT.idFromName(row.id));
	const doRes = await stub.fetch("https://note-agent/captures");
	if (!doRes.ok) {
		return c.json({ error: "note agent unavailable" }, 500);
	}
	const { captures } = (await doRes.json()) as { captures: unknown[] };

	return c.json({
		id: row.id,
		state: row.state,
		preview: row.preview,
		captures,
	});
});

app.all("/api/*", async (c) => c.json({ error: "not found" }, 404));

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname.startsWith("/api/")) {
			return app.fetch(request, env, ctx);
		}
		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Bindings>;
