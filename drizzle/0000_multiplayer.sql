CREATE TABLE game_rooms (
  code TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX game_rooms_expiry ON game_rooms (expires_at);
