-- Rename userId to user_id in user_themes table
ALTER TABLE "user_themes" RENAME COLUMN "userId" TO "user_id";
DROP INDEX "user_themes_userId_key";
CREATE UNIQUE INDEX "user_themes_user_id_key" ON "user_themes"("user_id");
ALTER TABLE "user_themes" DROP CONSTRAINT "user_themes_userId_fkey";
ALTER TABLE "user_themes" ADD CONSTRAINT "user_themes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
