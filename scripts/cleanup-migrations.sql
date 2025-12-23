-- Clean up failed/incorrect migration entries
DELETE FROM "_prisma_migrations" WHERE migration_name = '20250117200000_add_estimated_monthly_rent';
DELETE FROM "_prisma_migrations" WHERE migration_name = '20251118112538_';

-- Show remaining migrations
SELECT migration_name, started_at, finished_at, applied_steps_count 
FROM "_prisma_migrations" 
ORDER BY started_at;

