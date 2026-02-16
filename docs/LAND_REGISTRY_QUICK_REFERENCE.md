# Land Registry Integration - Quick Reference

**For:** Developers and AI assistants working on this codebase

## What Changed?

Enhanced the Land Registry download system with:
- ✅ Pause/Resume/Cancel functionality
- ✅ Real-time progress tracking (speed, ETA, bytes)
- ✅ Modern UI with enhanced progress indicators
- ✅ Better error handling and recovery

## Key Files Modified

1. **`prisma/schema.prisma`** - Added pause/resume fields to `LandRegistryImport` model
2. **`lib/land-registry.ts`** - Enhanced download logic with pause/resume/cancel
3. **`components/settings/land-registry-settings.tsx`** - Modern UI with progress indicators
4. **`app/api/admin/land-registry/import/[id]/pause/route.ts`** - New pause endpoint
5. **`app/api/admin/land-registry/import/[id]/resume/route.ts`** - New resume endpoint
6. **`app/api/admin/land-registry/import/[id]/cancel/route.ts`** - New cancel endpoint

## Database Migration Required

```bash
npm run db:migrate
# or
npx prisma migrate dev --name add_land_registry_pause_resume
```

## New API Endpoints

- `POST /api/admin/land-registry/import/[id]/pause` - Pause import
- `POST /api/admin/land-registry/import/[id]/resume` - Resume import
- `POST /api/admin/land-registry/import/[id]/cancel` - Cancel import

## How It Works

1. **Download**: Streams file with progress tracking (updates every 2s)
2. **Import**: Processes CSV in batches of 500 (updates every 2,500 records)
3. **Pause**: Saves state, can resume later
4. **Resume**: Restarts download but skips duplicates
5. **Cancel**: Stops and cleans up

## Status Values

- `PENDING` - Queued, not started
- `RUNNING` - Actively downloading/importing
- `PAUSED` - Paused by user, can resume
- `COMPLETED` - Successfully finished
- `FAILED` - Error occurred
- `CANCELLED` - Cancelled by user

## Progress Tracking

- **Download**: Bytes, speed (B/s), ETA (seconds)
- **Import**: Records, percentage, ETA (seconds)
- **Updates**: Every 2s for download, every 2,500 records for import

## For Claude AI

When working on Land Registry features:
- See `docs/LAND_REGISTRY_ENHANCEMENTS.md` for full details
- See `docs/API_REFERENCE.md` for API documentation
- See `lib/land-registry.ts` for implementation
- Pause/resume uses in-memory state map (`activeImports`)
- Resume restarts download but skips duplicates via Prisma `skipDuplicates: true`

---

*Last Updated: 2025-01-XX*

