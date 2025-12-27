# Vendor Model Usage Audit - 2025-12-27

## Executive Summary

This audit examines the usage of the **Vendor** (legacy) model vs the **VendorLead** (new pipeline) model to determine if consolidation is possible.

**Finding**: The `Vendor` model IS actively used in the codebase, but only in legacy routes. The system has effectively migrated to `VendorLead` for the main vendor pipeline.

---

## Model Comparison

### Vendor (Legacy Model)
**Location**: `prisma/schema.prisma` lines 587-635
**Table**: `vendors`
**Purpose**: Original vendor tracking system

**Fields**:
- Basic contact info (firstName, lastName, email, phone)
- Deal link (1:1 relationship with Deal)
- Source tracking (facebook_ad, facebookAdId, campaignId)
- Basic property details (askingPrice, propertyAddress, reasonForSale)
- Status tracking (VendorStatus enum: contacted, validated, offer_made, etc.)
- Legal details (solicitor info)

**Relations**:
- Deal (1:1) - via dealId
- VendorAIConversation (1:many)
- VendorOffer (1:many)
- Communication (1:many)

### VendorLead (New Pipeline Model)
**Location**: `prisma/schema.prisma` lines 757-869
**Table**: `vendor_leads`
**Purpose**: AI-powered vendor pipeline with SMS automation

**Fields**:
- Everything Vendor has, PLUS:
- Comprehensive property details (propertyType, bedrooms, bathrooms, squareFeet, condition)
- AI conversation state & history
- Motivation scoring (motivationScore, urgencyLevel, timelineDays)
- Deal validation (bmvScore, estimatedMarketValue, profitPotential, validationPassed)
- Comparables tracking (comparablesCount, avgComparablePrice, confidence)
- Offer management (offerAmount, offerPercentage, offerSentAt, offerAcceptedAt)
- Retry tracking (retryCount, nextRetryAt, videoSent)
- Rental estimates (estimatedMonthlyRent, estimatedAnnualRent, rentPerSqFt)
- Pipeline stages (13 stages vs Vendor's 8 statuses)
- Deal link (dealId)
- Investor pack tracking

**Relations**:
- SMSMessage (1:many)
- PipelineEvent (1:many)
- OfferRetry (1:many)
- ComparableProperty (1:many)
- ComparablesSnapshot (1:many)

**Key Difference**: VendorLead is **much more sophisticated** with AI automation, pipeline stages, and comprehensive tracking.

---

## Current Usage Analysis

### Files Using Vendor Model (Legacy)

#### 1. `/app/api/vendors/route.ts`
**Purpose**: CRUD operations for legacy Vendor model
**Usage**:
- `GET /api/vendors` - List vendors
- `POST /api/vendors` - Create vendor
- Duplicate checking by phone
- Deal linking

**Assessment**: ⚠️ **Legacy route** - Could be deprecated

#### 2. `/app/api/vendors/[id]/route.ts`
**Purpose**: Individual vendor operations
**Usage**:
- `GET /api/vendors/[id]` - Get vendor details
- `PATCH /api/vendors/[id]` - Update vendor
- `DELETE /api/vendors/[id]` - Delete vendor (admin only)

**Assessment**: ⚠️ **Legacy route** - Could be deprecated

#### 3. `/app/api/vendors/[id]/conversations/route.ts`
**Purpose**: VendorAIConversation management
**Usage**:
- Fetch conversations linked to Vendor

**Assessment**: ⚠️ **Legacy** - VendorAIConversation is also legacy

#### 4. `/app/api/vendors/[id]/offers/route.ts`
**Purpose**: VendorOffer management
**Usage**:
- List offers for vendor
- Create offers
- Update vendor status on offer

**Assessment**: ⚠️ **Legacy** - Offers now tracked in VendorLead model

#### 5. `/app/api/vendors/[id]/offers/[offerId]/route.ts`
**Purpose**: Individual offer operations
**Usage**:
- Update offer status
- Update vendor status based on offer decision

**Assessment**: ⚠️ **Legacy** - Offer management migrated to VendorLead

#### 6. `/app/api/analytics/workflow/route.ts`
**Purpose**: Workflow analytics
**Usage**:
- Count vendors by status
- Calculate conversion rates
- Time in stages

**Assessment**: ⚠️ **Legacy analytics** - Should use VendorLead pipeline metrics instead

#### 7. `/app/api/vendor-leads/[id]/investor-pack/route.ts`
**Purpose**: Generate investor pack from vendor lead
**Usage**:
- **IMPORTANT**: Checks if VendorLead has linked Deal
- Falls back to checking if phone number matches a Vendor record with a Deal
- **This is a bridge between old and new systems**

**Code (lines 109-129)**:
```typescript
// Check if there's a Vendor record with this phone number that has a deal
const existingVendor = await prisma.vendor.findFirst({
  where: {
    phone: vendorLead.vendorPhone,
  },
  include: {
    deal: true,
  },
})

if (existingVendor?.dealId && existingVendor.deal) {
  dealId = existingVendor.dealId
  console.log(`[Investor Pack] Found deal via vendor record: ${dealId}`)

  // Update vendor lead to reflect this link
  await prisma.vendorLead.update({
    where: { id: vendorLeadId },
    data: { dealId: dealId },
  })
}
```

**Assessment**: ✅ **Bridge logic** - Handles migration from old to new system

---

## Database Query Results

### Check if Vendor table has records:
```bash
# Run this query to check:
SELECT COUNT(*) FROM vendors;
```

**Expected**: If this returns 0, the Vendor model can be safely deprecated.
**Expected**: If this returns > 0, there are legacy vendors that may need migration.

### Check VendorLead count:
```bash
# Run this query:
SELECT COUNT(*) FROM vendor_leads;
```

**Expected**: This should have the majority of vendor records.

---

## Recommendations

### Option 1: Keep Both Models (Current State) ✅ SAFE
**Pros**:
- No risk of data loss
- Backward compatibility maintained
- Bridge logic in investor-pack route works

**Cons**:
- Code complexity (two vendor systems)
- Maintenance burden
- Developer confusion

**When to choose**: If there are production Vendor records in use.

---

### Option 2: Deprecate Vendor Model (Recommended if no data) ⚠️
**Prerequisites**:
1. ✅ Verify `vendors` table is empty OR
2. ✅ Migrate all Vendor records to VendorLead

**Steps**:
1. Check database: `SELECT COUNT(*) FROM vendors;`
2. If count > 0:
   - Create migration script to copy Vendor → VendorLead
   - Map fields appropriately
   - Preserve Deal links
3. If count = 0:
   - Mark `/app/api/vendors/` routes as deprecated
   - Add warning logs if anyone calls them
   - Remove after 2-4 weeks
4. Update investor-pack route:
   - Remove Vendor fallback logic (lines 109-129)
   - Only use VendorLead.dealId
5. Update analytics:
   - Use PipelineMetric model instead of Vendor aggregations
6. After 30 days:
   - Remove Vendor model from schema
   - Remove VendorAIConversation model
   - Remove VendorOffer model (superseded by VendorLead offer fields)

---

### Option 3: Soft Deprecation (Gradual Migration) ⚠️
**Steps**:
1. Add deprecation warnings to `/app/api/vendors/` routes
2. Update documentation to recommend VendorLead
3. Keep both models for 3-6 months
4. Monitor usage with logging
5. If no usage detected, proceed with full removal

---

## Impact Assessment

### If Vendor Model Removed:

#### Files to Update:
1. ✅ `/app/api/vendors/route.ts` - DELETE or deprecate
2. ✅ `/app/api/vendors/[id]/route.ts` - DELETE or deprecate
3. ✅ `/app/api/vendors/[id]/conversations/route.ts` - DELETE or deprecate
4. ✅ `/app/api/vendors/[id]/offers/route.ts` - DELETE or deprecate
5. ✅ `/app/api/vendors/[id]/offers/[offerId]/route.ts` - DELETE or deprecate
6. ⚠️ `/app/api/analytics/workflow/route.ts` - UPDATE to use VendorLead
7. ⚠️ `/app/api/vendor-leads/[id]/investor-pack/route.ts` - REMOVE bridge logic

#### Database Changes:
1. Drop `vendors` table
2. Drop `vendor_ai_conversations` table (legacy)
3. Drop `vendor_offers` table (if not used)
4. Remove `Vendor`, `VendorAIConversation`, `VendorOffer` models from schema

#### Risk Level: **MEDIUM**
- Data migration required if records exist
- Multiple API routes affected
- Need to verify no frontend uses old vendor routes

---

## Frontend Usage Check

### Search for Vendor Model References:
```bash
grep -r "api/vendors" components/ app/dashboard/
```

**Result**: Need to check if any frontend components call the legacy `/api/vendors/` endpoints.

---

## Decision Matrix

| Scenario | Recommendation | Action |
|----------|---------------|--------|
| `vendors` table is empty | Deprecate immediately | Follow Option 2 |
| `vendors` table has <10 records | Migrate & deprecate | Manual migration, then Option 2 |
| `vendors` table has 10-100 records | Soft deprecation | Follow Option 3 |
| `vendors` table has >100 records | Keep both | Follow Option 1, plan migration |
| Active users calling `/api/vendors/` | Keep both | Follow Option 1 |

---

## Next Steps

### Immediate Actions:
1. ✅ Run database query: `SELECT COUNT(*) FROM vendors;`
2. ✅ Run database query: `SELECT COUNT(*) FROM vendor_leads;`
3. ✅ Check frontend for vendor API usage: `grep -r "api/vendors" app/ components/`
4. ✅ Review git logs to see when Vendor routes were last modified

### Based on Results:
- **If vendors table is empty**: Proceed with deprecation (Option 2)
- **If vendors table has records**: Create migration plan
- **If frontend uses vendor routes**: Update frontend first, then deprecate

---

## Conclusion

**Current State**: The codebase has effectively migrated to VendorLead for the main vendor pipeline. The Vendor model is only used in legacy routes that appear unused.

**Recommended Path**:
1. Check database counts
2. If empty, deprecate Vendor model
3. If not empty, plan migration
4. Remove legacy code to reduce maintenance burden

**Timeline**: 2-4 weeks for safe deprecation after verification.

**Risk**: LOW if database checks pass, MEDIUM if migration required.
