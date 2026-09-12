CREATE TABLE IF NOT EXISTS notes (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	title TEXT,
	state TEXT NOT NULL DEFAULT 'active',
	preview TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS notes_user_updated ON notes (user_id, updated_at DESC);
