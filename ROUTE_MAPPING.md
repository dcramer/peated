# Complete Route Mapping: Next.js → TanStack Start

## Summary

- **Next.js Routes**: 81 routes
- **TanStack Start Routes**: 83 routes
- **Status**: ✅ All core routes mapped, some additional TanStack routes identified

## Complete Route Mapping

| #   | Next.js Route                                                                   | TanStack Start Route                             | Status | Notes                  |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------ | ------ | ---------------------- |
| 1   | `(admin)/admin/(default)`                                                       | `admin.tsx`                                      | ✅     | Admin dashboard        |
| 2   | `(admin)/admin/(default)/badges`                                                | `admin.badges.tsx`                               | ✅     | Admin badges list      |
| 3   | `(admin)/admin/(default)/badges/[badgeId]`                                      | `admin.badges.$badgeId.tsx`                      | ✅     | Admin badge details    |
| 4   | `(admin)/admin/(default)/events`                                                | `admin.events.tsx`                               | ✅     | Admin events list      |
| 5   | `(admin)/admin/(default)/events/[eventId]`                                      | `admin.events.$eventId.tsx`                      | ✅     | Admin event details    |
| 6   | `(admin)/admin/(default)/locations`                                             | `admin.locations.tsx`                            | ✅     | Admin locations list   |
| 7   | `(admin)/admin/(default)/locations/[countrySlug]/regions/[regionSlug]`          | `❌ MISSING`                                     | ⚠️     | Admin region details   |
| 8   | `(admin)/admin/(default)/locations/[countrySlug]/(tabs)`                        | `admin.locations.$countrySlug.tsx`               | ✅     | Admin country tabs     |
| 9   | `(admin)/admin/(default)/queue`                                                 | `admin.queue.tsx`                                | ✅     | Admin moderation queue |
| 10  | `(admin)/admin/(default)/sites`                                                 | `admin.sites.tsx`                                | ✅     | Admin sites list       |
| 11  | `(admin)/admin/(default)/sites/[siteId]/(tabs)`                                 | `admin.sites.$siteId.tsx`                        | ✅     | Admin site tabs        |
| 12  | `(admin)/admin/(default)/sites/[siteId]/(tabs)/reviews`                         | `admin.sites.$siteId.reviews.tsx`                | ✅     | Admin site reviews     |
| 13  | `(admin)/admin/(default)/tags`                                                  | `admin.tags.tsx`                                 | ✅     | Admin tags list        |
| 14  | `(admin)/admin/(default)/tags/[tagId]`                                          | `admin.tags.$tagId.tsx`                          | ✅     | Admin tag details      |
| 15  | `(admin)/admin/(default)/users`                                                 | `admin.users.tsx`                                | ✅     | Admin users list       |
| 16  | `(admin)/admin/(layout-free)/badges/add`                                        | `admin.badges.add.tsx`                           | ✅     | Add badge form         |
| 17  | `(admin)/admin/(layout-free)/badges/[badgeId]/edit`                             | `admin.badges.$badgeId.edit.tsx`                 | ✅     | Edit badge form        |
| 18  | `(admin)/admin/(layout-free)/events/add`                                        | `admin.events.add.tsx`                           | ✅     | Add event form         |
| 19  | `(admin)/admin/(layout-free)/events/[eventId]/edit`                             | `admin.events.$eventId.edit.tsx`                 | ✅     | Edit event form        |
| 20  | `(admin)/admin/(layout-free)/locations/[countrySlug]/edit`                      | `admin.locations.$countrySlug.edit.tsx`          | ✅     | Edit country form      |
| 21  | `(admin)/admin/(layout-free)/locations/[countrySlug]/regions/add`               | `admin.locations.$countrySlug.regions.add.tsx`   | ✅     | Add region form        |
| 22  | `(admin)/admin/(layout-free)/locations/[countrySlug]/regions/[regionSlug]/edit` | `❌ MISSING`                                     | ⚠️     | Edit region form       |
| 23  | `(admin)/admin/(layout-free)/sites/add`                                         | `admin.sites.add.tsx`                            | ✅     | Add site form          |
| 24  | `(admin)/admin/(layout-free)/sites/[siteId]/edit`                               | `admin.sites.$siteId.edit.tsx`                   | ✅     | Edit site form         |
| 25  | `(admin)/admin/(layout-free)/tags/add`                                          | `admin.tags.add.tsx`                             | ✅     | Add tag form           |
| 26  | `(admin)/admin/(layout-free)/tags/[tagId]/edit`                                 | `admin.tags.$tagId.edit.tsx`                     | ✅     | Edit tag form          |
| 27  | `(bottles-sidebar)/bottles`                                                     | `bottles.tsx`                                    | ✅     | Bottles list           |
| 28  | `(default)/about`                                                               | `about.tsx`                                      | ✅     | About page             |
| 29  | `(default)/(activity)`                                                          | `activity.tsx`                                   | ✅     | Activity dashboard     |
| 30  | `(default)/(activity)/activity/friends`                                         | `activity.friends.tsx`                           | ✅     | Friends activity       |
| 31  | `(default)/(activity)/activity/local`                                           | `activity.local.tsx`                             | ✅     | Local activity         |
| 32  | `(default)/badges/[badgeId]`                                                    | `badges.$badgeId.tsx`                            | ✅     | Badge details          |
| 33  | `(default)/bottles/[bottleId]/aliases`                                          | `bottles.$bottleId.aliases.tsx`                  | ✅     | Bottle aliases         |
| 34  | `(default)/bottles/[bottleId]/(tabs)`                                           | `bottles.$bottleId.tsx`                          | ✅     | Bottle details         |
| 35  | `(default)/bottles/[bottleId]/(tabs)/prices`                                    | `bottles.$bottleId.prices.tsx`                   | ✅     | Bottle prices          |
| 36  | `(default)/bottles/[bottleId]/(tabs)/releases`                                  | `bottles.$bottleId.releases.tsx`                 | ✅     | Bottle releases        |
| 37  | `(default)/bottles/[bottleId]/(tabs)/similar`                                   | `bottles.$bottleId.similar.tsx`                  | ✅     | Similar bottles        |
| 38  | `(default)/bottles/[bottleId]/(tabs)/tastings`                                  | `bottles.$bottleId.tastings.tsx`                 | ✅     | Bottle tastings        |
| 39  | `(default)/entities/[entityId]/aliases`                                         | `entities.$entityId.aliases.tsx`                 | ✅     | Entity aliases         |
| 40  | `(default)/entities/[entityId]/(tabs)`                                          | `entities.$entityId.tsx`                         | ✅     | Entity details         |
| 41  | `(default)/entities/[entityId]/(tabs)/bottles`                                  | `entities.$entityId.bottles.tsx`                 | ✅     | Entity bottles         |
| 42  | `(default)/entities/[entityId]/(tabs)/codes`                                    | `entities.$entityId.codes.tsx`                   | ✅     | Entity codes           |
| 43  | `(default)/entities/[entityId]/(tabs)/tastings`                                 | `entities.$entityId.tastings.tsx`                | ✅     | Entity tastings        |
| 44  | `(default)/favorites`                                                           | `❌ MISSING`                                     | ⚠️     | User favorites         |
| 45  | `(default)/flights`                                                             | `flights.tsx`                                    | ✅     | Flights list           |
| 46  | `(default)/flights/[flightId]`                                                  | `flights.$flightId.tsx`                          | ✅     | Flight details         |
| 47  | `(default)/friends`                                                             | `friends.tsx`                                    | ✅     | Friends list           |
| 48  | `(default)/locations/[countrySlug]/regions/[regionSlug]/(tabs)`                 | `locations.$countrySlug.regions.$regionSlug.tsx` | ✅     | Region details         |
| 49  | `(default)/locations/[countrySlug]/(tabs)`                                      | `locations.$countrySlug.tsx`                     | ✅     | Country details        |
| 50  | `(default)/locations/[countrySlug]/(tabs)/regions`                              | `locations.$countrySlug.regions.tsx`             | ✅     | Country regions        |
| 51  | `(default)/locations/(tabs)`                                                    | `locations.tsx`                                  | ✅     | Locations list         |
| 52  | `(default)/locations/(tabs)/all-regions`                                        | `locations.all-regions.tsx`                      | ✅     | All regions            |
| 53  | `(default)/notifications/(tabs)`                                                | `notifications.tsx`                              | ✅     | Notifications          |
| 54  | `(default)/notifications/(tabs)/all`                                            | `notifications.all.tsx`                          | ✅     | All notifications      |
| 55  | `(default)/tastings`                                                            | `tastings.tsx`                                   | ✅     | Tastings list          |
| 56  | `(default)/tastings/[tastingId]`                                                | `tastings.$tastingId.tsx`                        | ✅     | Tasting details        |
| 57  | `(default)/updates`                                                             | `updates.tsx`                                    | ✅     | Updates page           |
| 58  | `(default)/users/[username]/(tabs)`                                             | `users.$username.tsx`                            | ✅     | User profile           |
| 59  | `(default)/users/[username]/(tabs)/favorites`                                   | `users.$username.favorites.tsx`                  | ✅     | User favorites         |
| 60  | `(entities-sidebar)/bottlers`                                                   | `bottlers.tsx`                                   | ✅     | Bottlers list          |
| 61  | `(entities-sidebar)/brands`                                                     | `brands.tsx`                                     | ✅     | Brands list            |
| 62  | `(entities-sidebar)/distillers`                                                 | `distillers.tsx`                                 | ✅     | Distillers list        |
| 63  | `(layout-free)/addBottle`                                                       | `addBottle.tsx`                                  | ✅     | Add bottle form        |
| 64  | `(layout-free)/addEntity`                                                       | `addEntity.tsx`                                  | ✅     | Add entity form        |
| 65  | `(layout-free)/addFlight`                                                       | `addFlight.tsx`                                  | ✅     | Add flight form        |
| 66  | `(layout-free)/bottles/[bottleId]/addRelease`                                   | `bottles.$bottleId.addRelease.tsx`               | ✅     | Add bottle release     |
| 67  | `(layout-free)/bottles/[bottleId]/addTasting`                                   | `bottles.$bottleId.addTasting.tsx`               | ✅     | Add bottle tasting     |
| 68  | `(layout-free)/bottles/[bottleId]/edit`                                         | `bottles.$bottleId.edit.tsx`                     | ✅     | Edit bottle            |
| 69  | `(layout-free)/bottles/[bottleId]/merge`                                        | `bottles.$bottleId.merge.tsx`                    | ✅     | Merge bottles          |
| 70  | `(layout-free)/bottles/[bottleId]/releases/[releaseId]/edit`                    | `bottles.$bottleId.releases.$releaseId.edit.tsx` | ✅     | Edit bottle release    |
| 71  | `(layout-free)/entities/[entityId]/edit`                                        | `entities.$entityId.edit.tsx`                    | ✅     | Edit entity            |
| 72  | `(layout-free)/entities/[entityId]/merge`                                       | `entities.$entityId.merge.tsx`                   | ✅     | Merge entities         |
| 73  | `(layout-free)/flights/[flightId]/edit`                                         | `flights.$flightId.edit.tsx`                     | ✅     | Edit flight            |
| 74  | `(layout-free)/flights/[flightId]/overlay`                                      | `flights.$flightId.overlay.tsx`                  | ✅     | Flight overlay         |
| 75  | `(layout-free)/login`                                                           | `login.tsx`                                      | ✅     | Login page             |
| 76  | `(layout-free)/register`                                                        | `register.tsx`                                   | ✅     | Register page          |
| 77  | `(layout-free)/search`                                                          | `search.tsx`                                     | ✅     | Search page            |
| 78  | `(layout-free)/settings`                                                        | `settings.tsx`                                   | ✅     | Settings page          |
| 79  | `(layout-free)/tastings/[tastingId]/edit`                                       | `tastings.$tastingId.edit.tsx`                   | ✅     | Edit tasting           |
| 80  | `(layout-free)/verify`                                                          | `verify.tsx`                                     | ✅     | Verify account         |
| 81  | `password-reset`                                                                | `password-reset.tsx`                             | ✅     | Password reset         |

## Additional TanStack Start Routes (Not in Next.js)

| Route              | Purpose              | Status   |
| ------------------ | -------------------- | -------- |
| `error.tsx`        | Error boundary       | ✅ Valid |
| `global-error.tsx` | Global error handler | ✅ Valid |
| `layout.tsx`       | Layout component     | ✅ Valid |
| `not-found.tsx`    | 404 page             | ✅ Valid |
| `_health.tsx`      | Health check         | ✅ Valid |

## Missing Routes Analysis

### ⚠️ Missing Routes (2 routes)

1. **Admin Region Details**: `(admin)/admin/(default)/locations/[countrySlug]/regions/[regionSlug]`

   - Should be: `admin.locations.$countrySlug.regions.$regionSlug.tsx`
   - **Action Required**: Create missing route

2. **Admin Edit Region**: `(admin)/admin/(layout-free)/locations/[countrySlug]/regions/[regionSlug]/edit`

   - Should be: `admin.locations.$countrySlug.regions.$regionSlug.edit.tsx`
   - **Action Required**: Create missing route

3. **User Favorites**: `(default)/favorites`
   - Should be: `favorites.tsx`
   - **Action Required**: Create missing route

## Summary

✅ **Successfully Migrated**: 78/81 routes (96.3%)
⚠️ **Missing Routes**: 3/81 routes (3.7%)
➕ **Additional Valid Routes**: 5 TanStack-specific routes

### Next Actions

1. Create 3 missing routes
2. Verify all routes compile and function correctly
3. Proceed to API usage fixes
