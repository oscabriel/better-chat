/**
 * Crypto utilities for encrypting sensitive user data (API keys, tokens, etc.)
 * Uses Web Crypto API with AES-GCM for authenticated encryption
 */

// Maximum number of derived keys to cache (prevents memory leaks)
const MAX_CACHE_SIZE = 1000;

// Cache for derived keys to avoid repeated derivation
const keyCache = new Map<string, CryptoKey>();

/**
 * Adds a key to the cache with LRU-style eviction when cache is full
 */
function addToCache(key: string, value: CryptoKey): void {
	if (keyCache.size >= MAX_CACHE_SIZE) {
		// Remove the oldest entry (first in the Map)
		const firstKey = keyCache.keys().next().value;
		if (firstKey !== undefined) {
			keyCache.delete(firstKey);
		}
	}
	keyCache.set(key, value);
}

/**
 * Derives a user-specific encryption key from the master key and userId
 * Uses PBKDF2 to derive a unique key per user for additional isolation
 */
async function deriveUserKey(
	masterKey: string,
	userId: string,
): Promise<CryptoKey> {
	const lookupKey = `${masterKey.slice(0, 8)}:${userId}`;
	const cached = keyCache.get(lookupKey);
	if (cached) return cached;

	// Create key material from master key
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(masterKey),
		"PBKDF2",
		false,
		["deriveBits", "deriveKey"],
	);

	// Derive a unique key for this user using PBKDF2
	const derivedKey = await crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: new TextEncoder().encode(`better-chat-${userId}`),
			iterations: 100000,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);

	addToCache(lookupKey, derivedKey);
	return derivedKey;
}

/**
 * Encrypts a plaintext string using AES-GCM
 * Returns base64-encoded string in format: iv:ciphertext
 */
export async function encryptApiKey(
	plaintext: string,
	masterKey: string,
	userId: string,
): Promise<string> {
	if (!plaintext || !masterKey || !userId) {
		throw new Error("Missing required parameters for encryption");
	}

	const key = await deriveUserKey(masterKey, userId);

	// Generate a random IV for this encryption
	const iv = crypto.getRandomValues(new Uint8Array(12));

	// Encrypt the data
	const encodedText = new TextEncoder().encode(plaintext);
	const ciphertext = await crypto.subtle.encrypt(
		{
			name: "AES-GCM",
			iv,
		},
		key,
		encodedText,
	);

	// Combine IV and ciphertext, encode as base64
	const combined = new Uint8Array(iv.length + ciphertext.byteLength);
	combined.set(iv, 0);
	combined.set(new Uint8Array(ciphertext), iv.length);

	return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a base64-encoded encrypted string
 * Expects format: iv:ciphertext (as returned by encryptApiKey)
 */
export async function decryptApiKey(
	encrypted: string,
	masterKey: string,
	userId: string,
): Promise<string> {
	if (!encrypted || !masterKey || !userId) {
		throw new Error("Missing required parameters for decryption");
	}

	const key = await deriveUserKey(masterKey, userId);

	// Decode base64
	const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

	// Extract IV and ciphertext
	const iv = combined.slice(0, 12);
	const ciphertext = combined.slice(12);

	// Decrypt the data
	const decrypted = await crypto.subtle.decrypt(
		{
			name: "AES-GCM",
			iv,
		},
		key,
		ciphertext,
	);

	return new TextDecoder().decode(decrypted);
}

/**
 * Encrypts a record of API keys (provider -> key mapping)
 * Returns a record with encrypted values
 */
export async function encryptApiKeys(
	apiKeys: Record<string, string>,
	masterKey: string,
	userId: string,
): Promise<Record<string, string>> {
	const encrypted: Record<string, string> = {};

	for (const [provider, key] of Object.entries(apiKeys)) {
		if (key) {
			encrypted[provider] = await encryptApiKey(key, masterKey, userId);
		}
	}

	return encrypted;
}

/**
 * Decrypts a record of encrypted API keys
 * Returns a record with plaintext values
 * Throws if any decryption fails - caller should handle errors
 */
export async function decryptApiKeys(
	encryptedKeys: Record<string, string>,
	masterKey: string,
	userId: string,
): Promise<Record<string, string>> {
	const decrypted: Record<string, string> = {};

	for (const [provider, encryptedKey] of Object.entries(encryptedKeys)) {
		if (encryptedKey) {
			decrypted[provider] = await decryptApiKey(
				encryptedKey,
				masterKey,
				userId,
			);
		}
	}

	return decrypted;
}

/**
 * Checks if a string appears to be encrypted (base64 encoded with sufficient length)
 */
export function isEncrypted(value: string): boolean {
	if (!value || value.length < 20) return false;

	// Check if it's valid base64
	try {
		const decoded = atob(value);
		// Encrypted values should be at least 12 bytes (IV) + some ciphertext
		return decoded.length >= 12;
	} catch {
		return false;
	}
}
