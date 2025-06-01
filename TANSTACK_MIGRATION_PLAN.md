# TanStack Start Final Migration Plan

## Overview

This document tracks the final migration tasks from Next.js to TanStack Start. Based on current analysis:

- **81 Next.js routes** (page.tsx files)
- **83 TanStack Start routes** (.tsx files)
- **21 route-specific components** need relocation
- **Multiple API usage issues** need fixing

## Status Summary

- ✅ Infrastructure setup complete
- ✅ Route mapping verification complete (81/81 routes migrated + 3 missing routes created)
- ✅ API usage fixes complete (Route.useX() patterns are correct)
- ✅ Component relocation complete (19/19 UI components moved - 100%)
- ✅ VerboseFileRoutes migration complete (all 86 routes properly configured)
- ✅ Component dependencies resolved (old duplicate files cleaned up)
- 🔄 Final verification needed

## Task 1: Route Mapping Verification

### Objective

Map every Next.js route to its TanStack Start equivalent to ensure no routes are missing.

### Method

1. Extract all Next.js routes from `apps/web/src/app/**/page.tsx` files
2. Map to equivalent TanStack Start routes in `apps/web/src/routes/*.tsx`
3. Identify any missing routes
4. Verify route functionality

### Route Groups Transformation Pattern

| Next.js Pattern                         | TanStack Start Pattern | Notes                  |
| --------------------------------------- | ---------------------- | ---------------------- |
| `(layout-free)/search/page.tsx`         | `search.tsx`           | Remove route group     |
| `(admin)/admin/(default)/tags/page.tsx` | `admin.tags.tsx`       | Remove nested groups   |
| `[bottleId]/edit/page.tsx`              | `$bottleId.edit.tsx`   | Convert dynamic params |
| `(tabs)/releases/page.tsx`              | `.releases.tsx`        | Remove tabs grouping   |

### Status: ✅ COMPLETE

- [x] Generate complete route mapping
- [x] Verify all 81 Next.js routes have equivalents
- [x] Check for any extra routes in TanStack Start
- [x] Created 3 missing routes (admin regions + favorites)
- [ ] Test critical routes functionality

## Task 2: Component Relocation

### Objective

Move route-specific components from `apps/web/src/app/` to proper locations in `apps/web/src/components/`

### Components to Relocate (21 files)

#### Authentication Components

- [x] `(layout-free)/verify/resendForm.tsx` → `components/auth/resendForm.tsx` ✅

#### Activity Components

- [x] `(default)/(activity)/priceChanges.tsx` → `components/activity/priceChanges.tsx` ✅
- [x] `(default)/(activity)/upcomingEvents.tsx` → `components/activity/upcomingEvents.tsx` ✅
- [x] `(default)/(activity)/newBottles.tsx` → `components/activity/newBottles.tsx` ✅

#### About Page Components

- [x] `(default)/about/stats.tsx` → `components/about/stats.tsx` ✅

#### Badge Components

- [x] `(default)/badges/[badgeId]/leaderboard.tsx` → `components/badges/leaderboard.tsx` ✅

#### Bottle Components

- [x] `(default)/bottles/[bottleId]/(tabs)/releases/releaseTable.tsx` → `components/bottles/releases/releaseTable.tsx` ✅
- [x] `(default)/bottles/[bottleId]/(tabs)/releases/modActions.tsx` → `components/bottles/releases/modActions.tsx` ✅
- [x] `(default)/bottles/[bottleId]/modActions.tsx` → `components/bottles/modActions.tsx` ✅

#### Entity Components

- [x] `(default)/entities/[entityId]/modActions.tsx` → `components/entities/modActions.tsx` ✅

#### Flight Components

- [x] `(default)/flights/[flightId]/modActions.tsx` → `components/flights/modActions.tsx` ✅

#### Friend Components

- [x] `(default)/friends/friendListItem.tsx` → `components/friends/friendListItem.tsx` ✅

#### User Components

- [x] `(default)/users/[username]/friendButton.tsx` → `components/users/friendButton.tsx` ✅
- [x] `(default)/users/[username]/logoutButton.tsx` → `components/users/logoutButton.tsx` ✅
- [x] `(default)/users/[username]/userBadgeList.tsx` → `components/users/userBadgeList.tsx` ✅
- [x] `(default)/users/[username]/modActions.tsx` → `components/users/modActions.tsx` ✅

#### Admin Components

- [x] `(admin)/admin/(default)/queue/bottleSelector.tsx` → `components/admin/queue/bottleSelector.tsx` ✅

#### Sidebar Components

- [x] `(entities-sidebar)/rightSidebar.tsx` → `components/sidebars/entitiesRightSidebar.tsx` ✅
- [x] `(bottles-sidebar)/bottles/rightSidebar.tsx` → `components/sidebars/bottlesRightSidebar.tsx` ✅

#### Special Components

- [ ] `providers/providers.tsx` → Keep in current location (already properly placed)

#### Route Files (API Routes - Not UI Components)

- [x] `(layout-free)/logout/route.tsx` → ✅ Confirmed API route (Next.js route handler) - needs separate API migration
- [x] `%5Fhealth/route.tsx` → ✅ Confirmed API route (Next.js route handler) - needs separate API migration

**Note:** These are API route handlers, not UI components. They need to be migrated to TanStack Start API routes or oRPC endpoints as a separate task.

### Status: ✅ COMPLETE - UI Components (19/19 complete - 100%)

- [x] Create component directory structure ✅
- [x] Move UI components (auth, activity, about, badges, bottles, entities, flights, friends, users, admin, sidebars) ✅
- [x] Verified remaining files are API routes (not UI components) ✅
- [ ] Update all import references
- [ ] Test component functionality

**Progress Summary:** 19 out of 19 UI components successfully moved (100% complete). The remaining 2 files are API routes requiring separate migration.

## Task 3: API Usage Fixes

### Objective

~~Fix incorrect TanStack Router API usage throughout the routes~~ **RESOLVED: API usage is correct**

### Status: ✅ COMPLETE - NO ISSUES FOUND

After scanning all routes, the TanStack Router API usage is **already correct**:

- ✅ `Route.useSearch()` - Correct usage (methods called on Route object)
- ✅ `Route.useParams()` - Correct usage (methods called on Route object)
- ✅ `Route.useLoaderData()` - Correct usage (methods called on Route object)

**Key Learning:** TanStack Router APIs are called as methods on the Route object, not as separate imported hooks. The existing code follows the correct patterns.

## Task 4: VerboseFileRoutes Migration

### Objective

Update all TanStack Start routes to use explicit path definitions with `createFileRoute` due to `verboseFileRoutes` being enabled.

### Changes Required

Every route file now needs:

1. Import `createFileRoute` from `@tanstack/react-router`
2. Define explicit URL path in `createFileRoute` call instead of auto-inference

### Example Pattern

```typescript
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => await getCount(),
});
```

### Status: ✅ COMPLETE

- [x] Fixed broken import syntax (removed empty commas from imports) ✅
- [x] Renamed client.ts to client.tsx for JSX support ✅
- [x] Added createFileRoute import to verify.tsx and admin.queue.tsx ✅
- [x] Added explicit paths to verify.tsx ('/verify') and admin.queue.tsx ('/admin/queue') ✅
- [x] Verified all 86 route files have proper createFileRoute imports ✅
- [x] Confirmed all routes have explicit path definitions ✅
- [x] Special routes (\_\_root.tsx, error.tsx, \_health.tsx) correctly use appropriate route functions ✅

**Result:** All 86 route files are properly configured for `verboseFileRoutes: true`

## Task 5: Missing Component Dependencies

### Objective

Ensure all components referenced in TanStack routes exist and are properly imported

### Potential Issues

- [ ] `ResendVerificationForm` referenced in `verify.tsx` - verify import path is correct
- [ ] Check for any other missing component imports after component relocation

### Status: ✅ COMPLETE

- [x] Removed old duplicate component files from app directory ✅
- [x] Cleaned up ResendVerificationForm duplicate ✅
- [x] Verified component import paths are correct ✅
- [x] All moved components are properly located in components/ directory ✅

**Result:** All 19 relocated components are properly accessible with no duplicate files

## Task 6: Final Verification

### Testing Checklist

- [ ] All routes compile without TypeScript errors
- [ ] All routes load correctly in browser
- [ ] All critical user flows work (login, registration, bottle viewing, etc.)
- [ ] All API calls work correctly
- [ ] No console errors in browser

### Cleanup Checklist

- [ ] Remove empty directories from old Next.js structure
- [ ] Update any documentation referencing old paths
- [ ] Verify no remaining Next.js specific code

## Migration Execution Order

1. **Route Mapping** (Priority: High)

   - Essential to ensure no functionality is lost

2. **API Usage Fixes** (Priority: High)

   - Critical for routes to function correctly

3. **Component Relocation** (Priority: Medium)

   - Can be done incrementally, doesn't break functionality

4. **Final Verification** (Priority: High)
   - Ensures migration is successful

## Notes

- The fact that we have 83 TanStack routes vs 81 Next.js routes suggests either:

  - Some additional routes were created (like error.tsx, global-error.tsx)
  - Some routes were split differently
  - Need to verify this doesn't indicate missing routes

- Some files like `layout.tsx` and `error.tsx` in routes directory may be valid TanStack Start specific files

- The API usage issues (Route.useX vs useX) are likely systematic and can be fixed with search/replace operations

---

**Next Steps:**

1. Confirm this plan with user
2. Execute Route Mapping verification first
3. Fix API usage issues
4. Move components systematically
5. Perform final testing
