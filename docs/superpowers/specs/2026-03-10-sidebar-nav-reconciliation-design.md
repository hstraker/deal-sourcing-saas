# Sidebar Navigation Reconciliation

**Date:** 2026-03-10
**Status:** Approved

## Problem

Three navigation-related issues were identified:

1. **Nav items going to wrong pages** — Board and Portal Check both point to `/dashboard/vendors` (fallback TODO hrefs)
2. **Active state resets incorrectly** — `SidebarContext` runs `getSectionIdFromPath` on every pathname change, which always picks the first matching section. Since `/dashboard/vendors` appears in both Invest and Manage, Invest always wins even if the user clicked Manage.
3. **Dead code** — 3 files from a previous sidebar iteration are no longer used but still exist in the project.

Additionally, `PortalCheckDetailPanel` was built for the vendor detail modal but was never wired in.

## Design

### 1. File Cleanup (Delete 3 dead files)

| File | Reason |
|------|--------|
| `components/dashboard/sidebar.tsx` | Marked `@deprecated`, not imported anywhere |
| `components/layout/dual-sidebar.tsx` | Lowercase version, never imported (AppShell uses PascalCase) |
| `lib/navigation.ts` | Only referenced by the two deleted files above |

### 2. Active State Fix (`context/SidebarContext.tsx`)

**Root cause:** The `useEffect` on pathname change unconditionally calls `getSectionIdFromPath(pathname)`, which returns the *first* section containing the URL. URLs like `/dashboard/vendors` appear in multiple sections (Invest and Manage), so Manage never stays highlighted.

**Fix:** Before overwriting `activeSectionId`, check whether the current active section already contains the new pathname. If it does, leave the section alone.

```ts
useEffect(() => {
  const currentSection = NAV_SECTIONS.find(s => s.id === activeSectionId)
  const currentOwnsPath = currentSection?.groups.some(g =>
    g.items.some(item =>
      pathname === item.href || pathname.startsWith(item.href + "/")
    )
  )
  if (!currentOwnsPath) {
    setActiveSectionId(getSectionIdFromPath(pathname))
  }
}, [pathname])
```

This preserves the user's section choice when navigating within it, but still auto-switches when landing on a URL that only exists in another section.

### 3. Board Route (`app/dashboard/vendors/board/`)

Add a `defaultView` prop to `UnifiedVendorsView` that overrides the localStorage value on mount.

Create `app/dashboard/vendors/board/page.tsx` — a thin wrapper that renders `<UnifiedVendorsView defaultView="board" />`.

Update `config/navigation.ts`: Board href `/dashboard/vendors` → `/dashboard/vendors/board`.

### 4. Portal Check — Full End-to-End Flow

**Root cause of broken Portal Check:** `PortalCheckDetailPanel` was built as a modal tab but never wired in. No top-level page exists. The nav item had a TODO fallback to `/dashboard/vendors`.

**Two-part fix:**

**Part A — Modal tab**
Add an `initialTab` prop to `VendorLeadDetailModal`. Expand the tab grid from 3 to 4 columns. Add a Portal Check tab that renders `PortalCheckDetailPanel` with the lead's id and latest check data.

**Part B — List page**
Create `components/vendors/portal-check-list.tsx` — a client component that displays all vendor leads in a table with columns: Address, Stage, Risk badge, Last Checked. Sorted by severity (red_flag → caution → clear → null). Clicking a row opens `VendorLeadDetailModal` with `initialTab="portal-check"`.

Create `app/dashboard/vendors/portal-check/page.tsx` — server component that fetches leads and passes them to the list component.

Update `config/navigation.ts`: Portal Check href `/dashboard/vendors` → `/dashboard/vendors/portal-check`.

## Change Summary

| Action | File |
|--------|------|
| Delete | `components/dashboard/sidebar.tsx` |
| Delete | `components/layout/dual-sidebar.tsx` |
| Delete | `lib/navigation.ts` |
| Edit | `context/SidebarContext.tsx` |
| Edit | `config/navigation.ts` |
| Edit | `components/vendors/unified-vendors-view.tsx` |
| Edit | `components/vendors/vendor-lead-detail-modal.tsx` |
| Create | `app/dashboard/vendors/board/page.tsx` |
| Create | `app/dashboard/vendors/portal-check/page.tsx` |
| Create | `components/vendors/portal-check-list.tsx` |
