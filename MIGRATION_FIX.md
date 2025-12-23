# Fixing Failed Migration State

## Problem
The migration `20250117200000_add_estimated_monthly_rent` was incorrectly dated (before the table creation migrations) and has left a failed migration entry in the database.

## Solution

### Step 1: Remove the failed migration entry from the database

Connect to your PostgreSQL database and run:

```sql
-- Delete the failed migration entry
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20250117200000_add_estimated_monthly_rent';
```

You can do this via:
- `psql` command line: `psql -d dealstack -c "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20250117200000_add_estimated_monthly_rent';"`
- pgAdmin or any PostgreSQL client
- Or using Prisma Studio if available

### Step 2: Apply existing migrations

After cleaning up the failed migration entry, run:

```bash
npx prisma migrate deploy
```

This will apply the 3 existing migrations:
- `20251117144623_` (creates tables)
- `20251118112538_` (alters deals table)
- `20251118120000_deal_score_status_tracking` (adds deal score fields)

### Step 3: Create new migration for vendor pipeline

Once existing migrations are applied, create the new migration:

```bash
npx prisma migrate dev --name add_vendor_pipeline
```

This will create a new migration with all the vendor pipeline tables and fields.

## Alternative: If you want to start fresh

If you're in development and can afford to reset the database:

```bash
# Reset database and apply all migrations from scratch
npx prisma migrate reset

# This will:
# 1. Drop the database
# 2. Create a new database
# 3. Apply all migrations in order
# 4. Run seed scripts if any
```

**Warning**: This will delete all data in the database. Only use in development!

