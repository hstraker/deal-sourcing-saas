# Phase 1 MVP - Development Roadmap

## ✅ Completed Setup

- [x] Next.js 14 project initialized with TypeScript & App Router
- [x] Complete database schema (Prisma) with all tables
- [x] NextAuth.js authentication (email/password, JWT, role-based)
- [x] AWS S3 integration utilities
- [x] Folder structure created
- [x] Tailwind CSS configured with professional color scheme
- [x] Admin dashboard layout with sidebar navigation
- [x] Login page functional
- [x] Route protection middleware
- [x] Environment variables configured

---

## 🎯 Phase 1 MVP Features (Next Steps)

Based on `PROJECT_BRIEF.md`, Phase 1 MVP goals:

> **Goal:** Internal tool for team to manage deals
> 
> **Features:**
> - ✅ User authentication (admin, sourcer roles only)
> - ✅ Deal CRUD (create, read, update, delete)
> - ✅ Photo upload (S3) with presigned URLs
> - ✅ Basic deal scoring
> - ✅ Deal pipeline (Kanban board)
> - ⏳ PropertyData integration (auto-sourcing) - Optional for MVP
> - ✅ Simple deal list/grid view

---

## 📋 Recommended Development Order

### 1. Deal CRUD Operations (Priority: High)

**Create:**
- `/app/dashboard/deals/new/page.tsx` - Create new deal form
- `/app/api/deals/route.ts` - POST endpoint for creating deals
- Deal form component with all required fields

**Read:**
- `/app/dashboard/deals/page.tsx` - List all deals (table/grid view)
- `/app/dashboard/deals/[id]/page.tsx` - Deal detail page
- `/app/api/deals/route.ts` - GET endpoint for listing deals
- `/app/api/deals/[id]/route.ts` - GET endpoint for single deal

**Update:**
- `/app/dashboard/deals/[id]/edit/page.tsx` - Edit deal form
- `/app/api/deals/[id]/route.ts` - PUT endpoint for updating deals

**Delete:**
- ✅ Delete functionality in deal detail page (admin only)
- ✅ `/app/api/deals/[id]/route.ts` - DELETE endpoint
- ✅ Confirmation dialog with AlertDialog component

**Required Fields:**
- Property Details: address, postcode, property type, bedrooms, bathrooms
- Pricing: asking price, market value, estimated refurb cost
- Metrics: BMV%, yield, ROI, ROCE, deal score
- Status: new, review, in_progress, ready, listed, reserved, sold, archived
- Source: data source, external ID, agent details

---

### 2. Photo Upload (Priority: High)

**Features:**
- Photo upload component with drag & drop
- Upload to S3 with presigned URLs
- Photo gallery display
- Set cover photo
- Delete photos
- Max 15 photos per deal

**Create:**
- `/app/api/deals/[id]/photos/route.ts` - POST endpoint for photo upload
- `/app/api/deals/[id]/photos/[photoId]/route.ts` - DELETE endpoint
- Photo upload component using S3 utilities
- Photo gallery component

**Integration:**
- Add photo upload to deal create/edit forms
- Display photos on deal detail page

---

### 3. Deal Scoring Algorithm (Priority: Medium)

**Calculate Deal Score (0-100):**
- BMV percentage weight: 30%
- Yield weight: 25%
- Property condition: 15%
- Location score: 15%
- Market trends: 10%
- Additional factors: 5%

**Create:**
- `/lib/deal-scoring.ts` - Scoring algorithm
- Auto-calculate score when deal is created/updated
- Display score prominently in deal cards

---

### 4. Deal Pipeline - Kanban Board (Priority: High)

**Features:**
- Visual pipeline with columns: New → Review → In Progress → Ready → Listed → Sold
- Drag and drop deals between statuses
- Each card shows: photo, address, deal score, assigned to, days in status
- Filter by status, assigned to, postcode

**Create:**
- `/app/dashboard/deals/pipeline/page.tsx` - Kanban board view
- Kanban board component with drag-drop (use react-beautiful-dnd or dnd-kit)
- API endpoints for updating deal status
- Status change tracking

---

### 5. Deal List/Grid View (Priority: Medium)

**Features:**
- Table view with sorting and filtering
- Grid view with deal cards
- Filters: status, postcode, property type, deal score range
- Search by address/postcode
- Pagination

**Create:**
- Enhanced `/app/dashboard/deals/page.tsx`
- Deal list component (table)
- Deal grid component (cards)
- Filter/search components

---

### 6. PropertyData Integration (Priority: Low - Optional for MVP)

**Features:**
- Auto-fetch property details when address is entered
- Find comparable sales
- Calculate market value
- Store in database

**Create:**
- `/lib/propertydata.ts` - PropertyData API client
- `/app/api/propertydata/route.ts` - API endpoint wrapper
- Integration in deal creation form
- Cache aggressively (2,000 credits/month limit)

---

## 🛠️ Useful Components to Create

### UI Components (shadcn/ui)
```bash
# Install these as needed:
npx shadcn-ui@latest add select
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add table
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add tabs
```

### Custom Components Needed
- `DealForm` - Form for creating/editing deals
- `DealCard` - Card component for grid view
- `DealTable` - Table component for list view
- `PhotoUpload` - Drag & drop photo upload
- `PhotoGallery` - Display deal photos
- `KanbanBoard` - Pipeline board with drag-drop
- `DealFilters` - Filter component for deals
- `StatusBadge` - Badge showing deal status

---

## 📝 API Endpoints to Create

### Deals
```
GET    /api/deals                    # List all deals (with filters)
GET    /api/deals/:id                # Get single deal
POST   /api/deals                    # Create new deal
PUT    /api/deals/:id                # Update deal
DELETE /api/deals/:id                # Delete deal
PUT    /api/deals/:id/status         # Update deal status
```

### Photos
```
POST   /api/deals/:id/photos         # Upload photo
DELETE /api/deals/:id/photos/:photoId # Delete photo
PUT    /api/deals/:id/photos/:photoId/cover # Set as cover photo
```

---

## 🎨 Design Notes

- Use professional color scheme (already configured)
- Primary: #5865F2
- Success: #57F287
- Warning: #FEE75C
- Danger: #ED4245
- Clean, modern interface (inspired by Notion, Linear)
- Mobile responsive

---

## ✅ Testing Checklist

Before moving to Phase 2, ensure:

- [x] Can create a new deal
- [x] Can view all deals in list/grid
- [x] Can view single deal details
- [x] Can edit existing deal
- [x] Can delete deal
- [ ] Can upload photos to deal
- [ ] Can set cover photo
- [ ] Can delete photos
- [ ] Deal scoring works correctly
- [ ] Kanban board shows deals in correct columns
- [ ] Can drag deals between statuses
- [ ] Filters work on deal list
- [ ] Search works
- [ ] Authorization works (admin vs sourcer permissions)
- [ ] Mobile responsive

---

## 🚀 Quick Start for Next Feature

To start building Deal CRUD:

1. Create deal form component
2. Create API route for POST /api/deals
3. Create deal list page with GET /api/deals
4. Test creating and viewing deals

Then move on to photo upload, then Kanban board.

---

## 📚 Resources

- [Next.js 14 App Router Docs](https://nextjs.org/docs/app)
- [Prisma Docs](https://www.prisma.io/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [NextAuth.js Docs](https://next-auth.js.org)
- [AWS S3 SDK Docs](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3-examples.html)

---

**Good luck building Phase 1 MVP! 🎉**

