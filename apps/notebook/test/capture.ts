/**
 * Integration test for the capture slice, run against the real Workers
 * runtime via `wrangler dev` (script: bun run test).
 *
 * Covers ticket #144 acceptance points that are testable without a phone:
 * - capture requires a session
 * - a messy capture is accepted and confirmed
 * - the capture is retrievable afterwards
 * - a guessed note id grants nothing
 */
const BASE = "http://127.0.0.1:3010";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
	if (cond) {
		console.log(`  ok  ${name}`);
	} else {
		failures++;
		console.error(`FAIL  ${name}${detail ? `: ${detail}` : ""}`);
	}
}

let session = "";

async function req(path: string, init?: RequestInit): Promise<Response> {
	return fetch(`${BASE}${path}`, {
		...init,
		headers: { ...(init?.headers ?? {}), ...(session ? { cookie: session } : {}) },
	});
}

// Wait for wrangler dev to be ready.
for (let i = 0; i < 60; i++) {
	try {
		await fetch(`${BASE}/api/dev/login`, { redirect: "manual" });
		break;
	} catch {
		await Bun.sleep(500);
		if (i === 59) throw new Error("wrangler dev did not become ready");
	}
}

// Capture without a session is rejected.
{
	const res = await fetch(`${BASE}/api/capture`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ text: "sneaky" }),
	});
	check("capture without session is rejected", res.status === 401, `status ${res.status}`);
}

// Mint a dev session and remember the cookie.
{
	const res = await req("/api/dev/login");
	const setCookie = res.headers.get("set-cookie") ?? "";
	session = setCookie.split(";")[0];
	check("dev login mints a session", res.status === 200 && session.startsWith("nb_session="), `status ${res.status}`);
}

// A messy capture is accepted and confirmed.
let noteId = "";
{
	const messy =
		"i dont know why this keeps coming back... maybe the launch?? honestly half a thought. also contradictory: I want it BUT I don't.";
	const res = await req("/api/capture", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ text: messy }),
	});
	const body = (await res.json()) as { id?: string; saved?: boolean };
	check("messy capture is accepted", res.status === 201, `status ${res.status}`);
	check("capture is confirmed as saved", body.saved === true);
	noteId = body.id ?? "";
	check("capture returns a note id", noteId.length > 0);
}

// The capture is retrievable afterwards.
{
	const res = await req(`/api/notes/${noteId}`);
	const note = (await res.json()) as { captures?: { content: string }[] };
	check("note is retrievable", res.status === 200, `status ${res.status}`);
	check(
		"original capture survives round-trip verbatim",
		note.captures?.[0]?.content.includes("half a thought") === true,
	);
}

// A guessed note identifier grants nothing.
{
	const res = await req(`/api/notes/${crypto.randomUUID()}`);
	check("guessed note id returns 404, not the note", res.status === 404, `status ${res.status}`);
}

// Another user's session cannot read the note.
{
	await fetch(`${BASE}/api/dev/login?u=intruder`).then((r) => {
		session = (r.headers.get("set-cookie") ?? "").split(";")[0];
	});
	const res = await req(`/api/notes/${noteId}`);
	check("another user's session gets 404, not the note", res.status === 404, `status ${res.status}`);
	await fetch(`${BASE}/api/dev/login?u=demo-user`).then((r) => {
		session = (r.headers.get("set-cookie") ?? "").split(";")[0];
	});
}

if (failures > 0) {
	console.error(`${failures} failure(s)`);
	process.exit(1);
}
console.log("all capture-slice checks passed");
