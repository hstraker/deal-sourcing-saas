-- CreateTable
CREATE TABLE "user_themes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokens" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_themes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_themes_userId_key" ON "user_themes"("userId");

-- AddForeignKey
ALTER TABLE "user_themes" ADD CONSTRAINT "user_themes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
