-- Fix failed migration state in Prisma migrations table
-- This removes the failed migration entry so we can continue with new migrations

-- First, check what migrations are in the database
SELECT migration_name, started_at, finished_at, applied_steps_count 
FROM "_prisma_migrations" 
WHERE migration_name = '20250117200000_add_estimated_monthly_rent';

-- Delete the failed migration entry
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20250117200000_add_estimated_monthly_rent';

-- Verify it's gone
SELECT migration_name, started_at, finished_at 
FROM "_prisma_migrations" 
ORDER BY started_at;

