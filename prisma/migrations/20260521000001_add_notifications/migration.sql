-- CreateTable
CREATE TABLE IF NOT EXISTS "notifications" (
    "id"          TEXT NOT NULL,
    "user_id"     TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "category"    TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "body"        TEXT NOT NULL,
    "link"        TEXT,
    "read"        BOOLEAN NOT NULL DEFAULT false,
    "meta"        JSONB DEFAULT '{}',
    "dedupe_key"  TEXT,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- Unique constraint for deduplication (NULLs are treated as distinct, so multiple NULLs allowed)
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_user_id_dedupe_key_key"
    ON "notifications"("user_id", "dedupe_key");

-- Indexes for fast unread queries
CREATE INDEX IF NOT EXISTS "notifications_user_id_read_idx"
    ON "notifications"("user_id", "read");

CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx"
    ON "notifications"("user_id", "created_at" DESC);

-- Foreign key
ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
