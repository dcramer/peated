# TanStack Start Final Migration Plan

## Overview

This document tracks the final migration tasks from Next.js to TanStack Start. Based on current analysis:

- **81 Next.js routes** (page.tsx files)
- **83 TanStack Start routes** (.tsx files)
- **21 route-specific components** need relocation
- **Multiple API usage issues** need fixing

## Status Summary

- ✅ Infrastructure setup complete
- ✅ Basic route structure migrated (83 routes vs 81 original)
- 🔄 Route mapping verification needed
- 🔄 Component relocation needed
- 🔄 API usage fixes needed
- 🔄 Missing components check needed

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

- [ ] `(default)/(activity)/priceChanges.tsx` → `components/activity/priceChanges.tsx`
- [ ] `(default)/(activity)/upcomingEvents.tsx` → `components/activity/upcomingEvents.tsx`
- [ ] `(default)/(activity)/newBottles.tsx` → `components/activity/newBottles.tsx`

#### About Page Components

- [ ] `(default)/about/stats.tsx` → `components/about/stats.tsx`

#### Badge Components

- [ ] `(default)/badges/[badgeId]/leaderboard.tsx` → `components/badges/leaderboard.tsx`

#### Bottle Components

- [ ] `(default)/bottles/[bottleId]/(tabs)/releases/releaseTable.tsx` → `components/bottles/releases/releaseTable.tsx`
- [ ] `(default)/bottles/[bottleId]/(tabs)/releases/modActions.tsx` → `components/bottles/releases/modActions.tsx`
- [ ] `(default)/bottles/[bottleId]/modActions.tsx` → `components/bottles/modActions.tsx`

#### Entity Components

- [ ] `(default)/entities/[entityId]/modActions.tsx` → `components/entities/modActions.tsx`

#### Flight Components

- [ ] `(default)/flights/[flightId]/modActions.tsx` → `components/flights/modActions.tsx`

#### Friend Components

- [ ] `(default)/friends/friendListItem.tsx` → `components/friends/friendListItem.tsx`

#### User Components

- [ ] `(default)/users/[username]/friendButton.tsx` → `components/users/friendButton.tsx`
- [ ] `(default)/users/[username]/logoutButton.tsx` → `components/users/logoutButton.tsx`
- [ ] `(default)/users/[username]/userBadgeList.tsx` → `components/users/userBadgeList.tsx`
- [ ] `(default)/users/[username]/modActions.tsx` → `components/users/modActions.tsx`

#### Admin Components

- [ ] `(admin)/admin/(default)/queue/bottleSelector.tsx` → `components/admin/queue/bottleSelector.tsx`

#### Sidebar Components

- [ ] `(entities-sidebar)/rightSidebar.tsx` → `components/sidebars/entitiesRightSidebar.tsx`
- [ ] `(bottles-sidebar)/bottles/rightSidebar.tsx` → `components/sidebars/bottlesRightSidebar.tsx`

#### Special Components

- [ ] `providers/providers.tsx` → Keep in current location (already properly placed)

#### Route Files (Not Components)

- [ ] `(layout-free)/logout/route.tsx` → Should be API route, verify migration
- [ ] `%5Fhealth/route.tsx` → Should be API route, verify migration

### Status: 🔄 TODO

- [ ] Create component directory structure
- [ ] Move components with proper imports
- [ ] Update all import references
- [ ] Test component functionality

## Task 3: API Usage Fixes

### Objective

~~Fix incorrect TanStack Router API usage throughout the routes~~ **RESOLVED: API usage is correct**

### Status: ✅ COMPLETE - NO ISSUES FOUND

After scanning all routes, the TanStack Router API usage is **already correct**:

- ✅ `Route.useSearch()` - Correct usage (methods called on Route object)
- ✅ `Route.useParams()` - Correct usage (methods called on Route object)
- ✅ `Route.useLoaderData()` - Correct usage (methods called on Route object)

**Key Learning:** TanStack Router APIs are called as methods on the Route object, not as separate imported hooks. The existing code follows the correct patterns.

## Task 4: Missing Component Dependencies

### Objective

Ensure all components referenced in TanStack routes exist and are properly imported

### Potential Issues

- [ ] `ResendVerificationForm` referenced in `verify.tsx` - verify import path is correct
- [ ] Check for any other missing component imports after component relocation

### Status: 🔄 TODO

- [ ] Compile and check for import errors
- [ ] Fix any missing component references
- [ ] Update import paths after component moves

## Task 5: Final Verification

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
