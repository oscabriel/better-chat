export interface Capture {
	id: string;
	content: string;
	created_at: number;
}

/**
 * One NoteAgent per note (ADR-0002, ADR-0003).
 *
 * Owns the note's authoritative state: captures, document, revisions, turn
 * state. The D1 row is directory metadata only and can lag; this is the
 * source of truth. Step-1 slice: captures only.
 */
export class NoteAgent implements DurableObject {
	private readonly sql: SqlStorage;

	constructor(ctx: DurableObjectState, _env: unknown) {
		this.sql = ctx.storage.sql;
		this.init();
	}

	private init(): void {
		this.sql.exec(`
			CREATE TABLE IF NOT EXISTS captures (
				id TEXT PRIMARY KEY,
				content TEXT NOT NULL,
				created_at INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS revisions (
				id TEXT PRIMARY KEY,
				content TEXT NOT NULL,
				author TEXT NOT NULL,
				reason TEXT,
				created_at INTEGER NOT NULL
			);
		`);
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (request.method === "POST" && url.pathname === "/captures") {
			const body = (await request.json()) as { id?: string; content?: string };
			if (!body.id || typeof body.content !== "string" || body.content.length === 0) {
				return new Response("bad request", { status: 400 });
			}
			return this.addCapture(body.id, body.content);
		}
		if (request.method === "GET" && url.pathname === "/captures") {
			return Response.json({ captures: this.listCaptures() });
		}
		return new Response("not found", { status: 404 });
	}

	private addCapture(id: string, content: string): Response {
		// Idempotent by capture id; a retried submit must not duplicate the capture.
		const existing = this.sql
			.exec("SELECT id FROM captures WHERE id = ?", id)
			.toArray();
		if (existing.length > 0) {
			return Response.json({ ok: true, duplicate: true });
		}
		this.sql.exec(
			"INSERT INTO captures (id, content, created_at) VALUES (?, ?, ?)",
			id,
			content,
			Date.now(),
		);
		return Response.json({ ok: true });
	}

	private listCaptures(): Capture[] {
		return this.sql
			.exec("SELECT id, content, created_at FROM captures ORDER BY created_at")
			.toArray()
			.map((row) => ({
				id: row.id as string,
				content: row.content as string,
				created_at: row.created_at as number,
			}));
	}
}
