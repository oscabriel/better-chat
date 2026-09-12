/**
 * Auth seam for the capture slice.
 *
 * This is deliberately thin: an HMAC-signed session cookie so that note
 * identifiers are never the only access control (the Worker must check
 * ownership, per the proposal). The real auth decision (current Better Auth
 * against Workers, or something else) is an open decision in the proposal
 * and will replace this file wholesale.
 *
 * DEV_LOGIN=1 (local dev only) exposes /api/dev/login to mint a demo session.
 */

const COOKIE = "nb_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionUser {
	id: string;
}

async function hmac(secret: string, message: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSessionCookie(secret: string, userId: string): Promise<string> {
	const exp = Date.now() + SESSION_TTL_MS;
	const sig = await hmac(secret, `${userId}.${exp}`);
	return `${COOKIE}=${userId}.${exp}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`;
}

export async function readSession(
	secret: string,
	cookieHeader: string | null,
): Promise<SessionUser | null> {
	if (!cookieHeader) return null;
	const match = cookieHeader
		.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(`${COOKIE}=`));
	if (!match) return null;
	const [userId, expRaw, sig] = match.slice(COOKIE.length + 1).split(".");
	if (!userId || !expRaw || !sig) return null;
	const exp = Number(expRaw);
	if (!Number.isFinite(exp) || exp < Date.now()) return null;
	const expected = await hmac(secret, `${userId}.${exp}`);
	if (sig !== expected) return null;
	return { id: userId };
}
