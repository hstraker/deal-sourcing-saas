# Redundant Code Report - 2025-12-27

## Executive Summary

This report identifies unused files, duplicate code, and cleanup opportunities in the deal-sourcing-saas codebase. Total estimated cleanup: **~1,150 lines of dead code** + **16 instances of duplicate utilities**.

---

## 1. Unused Files (DELETE)

### ❌ lib/investor-pack-generator-old.ts
**Size**: 1,124 lines
**Status**: Not imported anywhere
**Reason**: Replaced by `lib/investor-pack-generator.ts`

**Evidence**:
- Grep search shows NO imports of this file in the codebase
- The new version at `lib/investor-pack-generator.ts` is actively used by:
  - `/app/api/deals/[id]/investor-pack/route.ts`
  - `/app/api/vendor-leads/[id]/investor-pack/route.ts`

**Recommendation**: ✅ **DELETE** - Safe to remove

**Commands**:
```bash
rm lib/investor-pack-generator-old.ts
```

---

### ❌ app/dashboard/vendors/pipeline/page.tsx
**Size**: ~30 lines
**Status**: Just redirects to `/dashboard/vendors/`
**Code**:
```typescript
export default function VendorPipelinePage() {
  redirect("/dashboard/vendors/")
}
```

**Recommendation**: ✅ **DELETE** - Unnecessary indirection

**Alternative**: If routing to `/dashboard/vendors/pipeline` is needed, handle redirect in middleware or parent layout instead of creating a dedicated page.

**Commands**:
```bash
rm app/dashboard/vendors/pipeline/page.tsx
```

---

## 2. Duplicate Code (CONSOLIDATE)

### 🔄 formatCurrency() - 16 Instances

**Problem**: Same utility function duplicated across 16 files

**Files**:
1. `components/comparables/comparable-property-card.tsx`
2. `components/comparables/comparables-analysis.tsx`
3. `components/dashboard/recent-comparables-card.tsx`
4. `components/dashboard/top-yields-card.tsx`
5. `components/deals/deal-list.tsx`
6. `components/deals/financial-pie-chart.tsx`
7. `components/deals/property-analysis-panel.tsx`
8. `components/settings/investor-management-dashboard.tsx`
9. `components/settings/investor-pack-templates-manager.tsx`
10. `components/vendors/pipeline-stats-cards.tsx`
11. `components/vendors/vendor-lead-detail-modal.tsx`
12. `components/vendors/vendor-list.tsx`
13. `components/vendors/vendor-offers.tsx`
14. `components/vendors/vendor-pipeline-board.tsx`
15. `components/vendors/vendor-pipeline-kanban-board.tsx`
16. `components/vendors/vendor-section.tsx`

**Current Implementation** (varies slightly):
```typescript
const formatCurrency = (amount: number | null) => {
  if (amount === null) return "N/A"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}
```

**Recommendation**: ✅ **CONSOLIDATE**

**Solution**:

1. Create `lib/format.ts`:
```typescript
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "N/A"

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "N/A"
  return num.toLocaleString("en-GB")
}

export function formatPercentage(
  num: number | null | undefined,
  decimals: number = 1
): string {
  if (num === null || num === undefined) return "N/A"
  return `${num.toFixed(decimals)}%`
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A"
  return new Date(date).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
```

2. Replace all 16 instances with import:
```typescript
import { formatCurrency } from "@/lib/format"
```

**Impact**: Removes ~240 lines of duplicate code

---

### 🔄 formatNumber() - Also Duplicated

**Problem**: Similar duplication of `formatNumber()` in same 16 files

**Recommendation**: ✅ Include in `lib/format.ts` (see above)

---

### 🔄 calculateStampDuty() - 3 Instances

**Problem**: Stamp duty calculation duplicated in 3 locations

**Files**:
1. ✅ `lib/calculations/deal-metrics.ts` (CANONICAL VERSION)
2. ❌ `lib/investor-pack-generator.ts` (duplicate)
3. ❌ `lib/investor-pack-generator-old.ts` (to be deleted)

**Canonical Implementation** (lib/calculations/deal-metrics.ts):
```typescript
export function calculateStampDuty(price: number): number {
  // UK Stamp Duty Land Tax calculation
  if (price <= 250000) return 0
  if (price <= 925000) return (price - 250000) * 0.05
  if (price <= 1500000) return 33750 + (price - 925000) * 0.10
  return 91250 + (price - 1500000) * 0.12
}
```

**Recommendation**: ✅ **CONSOLIDATE**

**Solution**:
1. Keep function in `lib/calculations/deal-metrics.ts`
2. Update `lib/investor-pack-generator.ts` to import it:
```typescript
import { calculateStampDuty } from "./calculations/deal-metrics"
```
3. Remove duplicate implementation from `investor-pack-generator.ts`
4. Delete `investor-pack-generator-old.ts` (contains third duplicate)

**Impact**: Removes 2 duplicate implementations

---

## 3. Vendor Data Model Confusion (REFACTOR)

### ⚠️ Problem: Three Overlapping Vendor Systems

**System 1: Vendor (Old)**
- Model: `Vendor` in Prisma schema
- API: `/api/vendors/`
- Location: `app/api/vendors/route.ts`
- Features: Basic vendor tracking
- Status: **LEGACY** - Appears mostly unused

**System 2: VendorLead (New Pipeline)**
- Model: `VendorLead` in Prisma schema
- API: `/api/vendor-pipeline/leads/`
- Location: `app/api/vendor-pipeline/`
- Features: Full AI-powered pipeline with SMS, BMV validation, offers
- Status: **ACTIVE** - Primary vendor system

**System 3: Hybrid Routes**
- API: `/api/vendor-leads/`
- Location: `app/api/vendor-leads/[id]/`
- Operates on: `VendorLead` model
- Features: BMV calculation, comparables, investor pack generation
- Status: **ACTIVE** - Confusingly named but necessary

**Issues**:
1. **Naming confusion**: `/api/vendor-leads/` vs `/api/vendor-pipeline/leads/` both work with `VendorLead`
2. **Legacy code**: Old `Vendor` model may not be needed
3. **Split routes**: Vendor functionality scattered across 3 API namespaces

**Evidence of Vendor Model Usage**:
- `Vendor` model has relation to `Deal` (one-to-one)
- Referenced in `Communication` model
- Has `VendorAIConversation` and `VendorOffer` relations
- But most vendor UI uses `VendorLead` exclusively

**Recommendation**: 🔧 **AUDIT & CONSOLIDATE**

**Action Steps**:
1. ✅ Audit database to see if any records exist in `Vendor` table
2. ✅ Check if any production code actively uses `Vendor` model (vs `VendorLead`)
3. ⚠️ If unused, consider migration:
   - Mark `Vendor` model as deprecated
   - Add migration to move any existing `Vendor` records to `VendorLead`
   - Remove old `Vendor` model from schema
4. 🔧 Consider consolidating routes:
   - Option A: Move everything to `/api/vendor-pipeline/`
   - Option B: Move everything to `/api/vendor-leads/`
   - Option C: Document clear separation of concerns

**Database Query to Check**:
```sql
SELECT COUNT(*) FROM vendors;
SELECT COUNT(*) FROM vendor_leads;
```

---

## 4. Vendor Component Duplication (EVALUATE)

### 🔄 Two Kanban Boards

**File 1**: `components/vendors/vendor-pipeline-board.tsx`
- Size: 238 lines
- Features: Simple kanban board
- Complexity: Basic

**File 2**: `components/vendors/vendor-pipeline-kanban-board.tsx`
- Size: 30,109 bytes (much larger)
- Features: Full-featured kanban with:
  - Drag-and-drop
  - Table view toggle
  - Advanced filtering
  - Search
  - Sorting
  - Bulk actions

**Usage**:
- The larger kanban board appears to be the one used in the unified vendors view
- The simple board may be legacy or used elsewhere

**Recommendation**: 🔍 **EVALUATE**

**Action Steps**:
1. ✅ Search codebase for imports of `vendor-pipeline-board.tsx`
2. ✅ If unused, delete it
3. ⚠️ If used, document where and why both are needed

**Commands**:
```bash
grep -r "vendor-pipeline-board" --include="*.tsx" --include="*.ts"
```

---

## 5. TODO Comments (COMPLETE)

### 📝 TODO #1: Time Metrics
**File**: `app/api/vendor-pipeline/stats/route.ts`
**Lines**: 130-131

**Code**:
```typescript
timeToOfferHours: 0, // TODO: Calculate from offerSentAt
timeToCloseDays: 0, // TODO: Calculate from dealClosedAt
```

**Recommendation**: ✅ **IMPLEMENT**

**Solution**:
```typescript
// Calculate average time from conversationStartedAt to offerSentAt
const avgTimeToOffer = await prisma.vendorLead.aggregate({
  where: {
    offerSentAt: { not: null },
    conversationStartedAt: { not: null },
  },
  _avg: {
    // Calculate diff in SQL or in JS
  }
})

// Calculate average time from offerAcceptedAt to dealClosedAt
const avgTimeToClose = await prisma.vendorLead.aggregate({
  where: {
    dealClosedAt: { not: null },
    offerAcceptedAt: { not: null },
  },
  _avg: {
    // Calculate diff
  }
})
```

---

### 📝 TODO #2: Square Footage Field
**File**: `app/api/vendor-leads/[id]/calculate-bmv/route.ts`
**Line**: 140

**Code**:
```typescript
// TODO: Add square footage field to VendorLead model for better valuation
```

**Status**: VendorLead model ALREADY HAS `squareFeet` field (line 778 of schema)

**Recommendation**: ✅ **DELETE COMMENT** - Already implemented

---

## 6. Large Commented Code Blocks

### ✅ CLEAN CODEBASE

**Result**: No large blocks (>20 lines) of commented-out code found.

The codebase is clean in this regard. Good practice maintained!

---

## 7. Dev/Test Routes (PROTECT)

### ⚠️ Development Routes in Codebase

**Routes**:
- `POST /api/dev/clear-test-data` - Clear test data
- `POST /api/dev/test-ai-conversation` - Test AI

**Current Protection**: Unknown

**Recommendation**: 🔒 **VERIFY PROTECTION**

**Action Steps**:
1. ✅ Ensure routes check `NODE_ENV === 'development'`
2. ✅ OR ensure admin-only access
3. ✅ OR disable completely in production

**Example Protection**:
```typescript
// At start of route handler
if (process.env.NODE_ENV === 'production') {
  return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
}

// OR require admin role
if (session.user.role !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

---

## 8. Unused Imports (LOW PRIORITY)

**Status**: Not scanned in detail

**Recommendation**: 🔧 **RUN LINTER**

**Commands**:
```bash
npm run lint
```

Most unused imports should be caught by ESLint. If not, consider adding:

**`.eslintrc.json`**:
```json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": ["warn", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }]
  }
}
```

---

## Cleanup Checklist

### High Priority (Do First)

- [ ] **DELETE** `lib/investor-pack-generator-old.ts` (1,124 lines)
- [ ] **CREATE** `lib/format.ts` with formatCurrency, formatNumber, formatPercentage, formatDate
- [ ] **REFACTOR** 16 files to use shared format utilities (removes ~240 lines)
- [ ] **REFACTOR** `lib/investor-pack-generator.ts` to import calculateStampDuty from deal-metrics
- [ ] **DELETE** duplicate calculateStampDuty from investor-pack-generator.ts

### Medium Priority (Do Next)

- [ ] **AUDIT** `Vendor` model usage vs `VendorLead`
  - [ ] Run database query: `SELECT COUNT(*) FROM vendors;`
  - [ ] Search codebase for `Vendor` model usage
  - [ ] Document or deprecate if unused
- [ ] **EVALUATE** if `vendor-pipeline-board.tsx` (simple version) is still needed
  - [ ] Search for imports
  - [ ] Delete if unused
- [ ] **DELETE** `app/dashboard/vendors/pipeline/page.tsx` (unnecessary redirect)
- [ ] **CONSOLIDATE** vendor routes under single namespace (document decision)

### Low Priority (Nice to Have)

- [ ] **IMPLEMENT** TODO #1: Time metrics in pipeline stats
  - [ ] Calculate timeToOfferHours
  - [ ] Calculate timeToCloseDays
- [ ] **DELETE** TODO #2 comment (squareFeet already exists)
- [ ] **VERIFY** dev routes are protected in production
- [ ] **RUN** `npm run lint` to catch unused imports
- [ ] **DOCUMENT** clear separation between `/api/vendor-leads/` and `/api/vendor-pipeline/`

---

## Expected Impact

### Code Quality Improvements
- **~1,150 lines** of dead code removed
- **~240 lines** of duplicate utilities consolidated
- **16 files** simplified by using shared utilities
- **Clearer architecture** with vendor model cleanup
- **Better maintainability** with single source of truth for formatting

### Developer Experience
- ✅ Easier to find formatting utilities (single location)
- ✅ Consistent formatting across the app
- ✅ Less confusion about which vendor system to use
- ✅ Faster file search (fewer files)
- ✅ Reduced bundle size (minimal, but measurable)

### Risk Assessment
- **Low Risk**: Deleting unused file (investor-pack-generator-old.ts)
- **Low Risk**: Creating shared format utilities (pure refactor)
- **Low Risk**: Deleting redirect page
- **Medium Risk**: Vendor model consolidation (requires database audit)
- **Medium Risk**: Deleting vendor-pipeline-board.tsx (check usage first)

---

## Recommendations Summary

### Immediate Actions (Can Do Today)
1. ✅ Delete `lib/investor-pack-generator-old.ts`
2. ✅ Create `lib/format.ts` with shared utilities
3. ✅ Refactor 3-4 files as proof of concept
4. ✅ Delete TODO #2 comment (already implemented)

### This Week
5. ✅ Refactor remaining 12-13 files to use shared format utilities
6. ✅ Consolidate calculateStampDuty usage
7. ✅ Audit Vendor model usage
8. ✅ Verify dev route protection

### This Month
9. ✅ Make decision on vendor model consolidation
10. ✅ Implement time metrics (TODO #1)
11. ✅ Clean up vendor route structure
12. ✅ Document architectural decisions

---

## Conclusion

The codebase is generally **clean and well-maintained**. The main issues are:

1. **One large unused file** (1,124 lines) - easy win
2. **Duplicate formatting utilities** (16 instances) - quick refactor
3. **Vendor model confusion** (3 systems) - needs architectural decision

**Total cleanup potential**: ~1,150 lines of dead code + consolidation of 16 duplicate utilities.

**Estimated effort**:
- High priority tasks: 2-4 hours
- Medium priority tasks: 4-8 hours
- Low priority tasks: 2-3 hours
- **Total**: 8-15 hours of cleanup work

**ROI**: High - significantly improves maintainability and reduces technical debt.
