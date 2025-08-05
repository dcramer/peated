# Rating Systems Architecture

## Overview

This document outlines the technical architecture for Peated's simple rating system, which has replaced the traditional 5-star scale with a simplified Pass/Sip/Savor system.

## Legacy Rating System (Deprecated)

### Database Schema

```sql
-- tastings table
ratingLegacy: doublePrecision("rating_legacy") -- 0.0 to 5.0, preserved for historical data

-- bottles table
avgRating: doublePrecision("avg_rating") -- Still used for legacy ratings
totalTastings: bigint("total_tastings") -- Count of all tastings
```

## Simple Rating System (Current)

### Database Schema

#### Tastings Table

```typescript
// Schema definition (replaced old rating column)
rating: smallint("rating"); // -1, 1, 2, or NULL
ratingLegacy: doublePrecision("rating_legacy"); // Preserved historical data
```

#### Bottles Table Additions

```typescript
// Detailed statistics for display and filtering
ratingStats: jsonb("rating_stats").$type<{
  pass: number; // count of -1 ratings
  sip: number; // count of 1 ratings
  savor: number; // count of 2 ratings
  total: number; // total simple ratings
  avg: number | null; // average rating for sorting
  percentage: {
    pass: number; // percentage who passed
    sip: number; // percentage who sipped
    savor: number; // percentage who savored
  };
}>();
```

### Value Mapping

| Numeric Value | Label     | Description                  | UI Display              |
| ------------- | --------- | ---------------------------- | ----------------------- |
| -1            | Pass      | Not my thing                 | 👎 (HandThumbDownIcon)  |
| 1             | Sip       | Enjoyable, would drink again | 👍 (HandThumbUpIcon)    |
| 2             | Savor     | Amazing, would seek out      | 👍👍 (Double thumbs up) |
| NULL          | No rating | User hasn't rated            | -                       |

### Why Numeric Values?

1. **Sorting**: `ORDER BY rating DESC` works naturally
2. **Filtering**: `WHERE rating >= 1` for positive ratings
3. **Aggregation**: Can calculate averages and statistics
4. **Performance**: Integer comparisons faster than strings
5. **Storage**: SMALLINT (2 bytes) vs VARCHAR (variable)

## Implementation Details

### 1. Database Migration

```sql
-- Migration up
ALTER TABLE tastings
ADD COLUMN rating_simple SMALLINT
CONSTRAINT tastings_rating_simple_check
CHECK (rating_simple IN (-1, 1, 2) OR rating_simple IS NULL);

ALTER TABLE bottles
ADD COLUMN avg_rating_simple DOUBLE PRECISION,
ADD COLUMN rating_simple_stats JSONB DEFAULT '{}';

-- Indexes for performance
CREATE INDEX tastings_rating_simple_idx ON tastings(rating_simple)
WHERE rating_simple IS NOT NULL;
```

### 2. API Schema Updates

```typescript
// TastingInputSchema addition
const TastingInputSchema = z
  .object({
    // ... existing fields
    rating: z.number().min(0).max(5).multipleOf(0.25).optional(),
    ratingSimple: z.literal(-1).or(z.literal(1)).or(z.literal(2)).optional(),
  })
  .refine(
    (data) => {
      // Only one rating type allowed per tasting
      const hasStarRating = data.rating !== undefined;
      const hasSimpleRating = data.ratingSimple !== undefined;
      return !(hasStarRating && hasSimpleRating);
    },
    { message: "Cannot provide both rating types" },
  );
```

### 3. Stats Calculation

```typescript
// Worker job: updateBottleStats
const updateSimpleRatingStats = async (bottleId: number) => {
  const stats = await db
    .select({
      pass: sql<number>`COUNT(*) FILTER (WHERE rating_simple = -1)`,
      sip: sql<number>`COUNT(*) FILTER (WHERE rating_simple = 1)`,
      savor: sql<number>`COUNT(*) FILTER (WHERE rating_simple = 2)`,
      total: sql<number>`COUNT(*) FILTER (WHERE rating_simple IS NOT NULL)`,
      avg: sql<number>`AVG(rating_simple) FILTER (WHERE rating_simple IS NOT NULL)`,
    })
    .from(tastings)
    .where(eq(tastings.bottleId, bottleId));

  const percentages = {
    pass: stats.total > 0 ? (stats.pass / stats.total) * 100 : 0,
    sip: stats.total > 0 ? (stats.sip / stats.total) * 100 : 0,
    savor: stats.total > 0 ? (stats.savor / stats.total) * 100 : 0,
  };

  await db
    .update(bottles)
    .set({
      avgRatingSimple: stats.avg,
      ratingSimpleStats: {
        pass: stats.pass,
        sip: stats.sip,
        savor: stats.savor,
        total: stats.total,
        percentage: percentages,
      },
    })
    .where(eq(bottles.id, bottleId));
};
```

### 4. Sorting Implementation

```typescript
// Bottle list endpoint
const sortOptions = {
  // Existing sorts
  rating: desc(bottles.avgRating),
  "-rating": asc(bottles.avgRating),

  // New simple rating sorts
  simpleRating: desc(bottles.avgRatingSimple),
  "-simpleRating": asc(bottles.avgRatingSimple),

  // Sort by "savor percentage"
  savorRate: desc(sql`(rating_simple_stats->>'percentage'->>'savor')::float`),
};
```

### 5. Filtering Options

```typescript
// Filter by minimum simple rating
if (input.minSimpleRating) {
  where.push(gte(bottles.avgRatingSimple, input.minSimpleRating));
}

// Filter by "would drink again" (sip or savor)
if (input.wouldDrinkAgain) {
  where.push(gt(bottles.avgRatingSimple, 0));
}
```

## Frontend Components

### SimpleRatingInput Component

```typescript
interface SimpleRatingInputProps {
  value?: -1 | 1 | 2 | null;
  onChange: (value: -1 | 1 | 2 | null) => void;
  disabled?: boolean;
}

const ratingOptions = [
  {
    value: -1,
    label: "Pass",
    icon: "🚫",
    description: "Would not drink again",
  },
  {
    value: 1,
    label: "Sip",
    icon: "🥃",
    description: "Enjoyable, would have occasionally",
  },
  {
    value: 2,
    label: "Savor",
    icon: "🥃🥃",
    description: "Excellent, would seek out",
  },
];
```

### SimpleRatingDisplay Component

```typescript
interface SimpleRatingDisplayProps {
  value: -1 | 1 | 2;
  showLabel?: boolean;
  size?: "small" | "medium" | "large";
}

// For bottle statistics
interface SimpleRatingStatsProps {
  stats: {
    pass: number;
    sip: number;
    savor: number;
    total: number;
    percentage: {
      pass: number;
      sip: number;
      savor: number;
    };
  };
}
```

## Coexistence Strategy

### Data Model

- Both rating types are optional
- Tastings can have one, the other, or neither
- No automatic conversion between systems

### Display Logic

```typescript
// Determine primary rating system for bottle
const getPrimaryRatingSystem = (bottle) => {
  const starCount = bottle.totalTastings;
  const simpleCount = bottle.ratingSimpleStats?.total || 0;

  return starCount >= simpleCount ? "stars" : "simple";
};
```

### User Preferences

```typescript
// Store in localStorage
interface UserPreferences {
  preferredRatingSystem: "stars" | "simple";
  lastUsedRatingSystem: "stars" | "simple";
}
```

## Migration Considerations

### Optional Historical Data Migration

```sql
-- Convert historical ratings (if desired)
UPDATE tastings
SET rating_simple = CASE
  WHEN rating < 2.0 THEN -1  -- Pass
  WHEN rating >= 2.0 AND rating <= 3.5 THEN 1  -- Sip
  WHEN rating > 3.5 THEN 2  -- Savor
END
WHERE rating IS NOT NULL
  AND rating_simple IS NULL
  AND created_at < '2024-01-01'; -- Only old data
```

### Rollback Strategy

```sql
-- Safe rollback (preserves data)
ALTER TABLE tastings
RENAME COLUMN rating_simple TO rating_simple_deprecated;

ALTER TABLE bottles
RENAME COLUMN avg_rating_simple TO avg_rating_simple_deprecated,
RENAME COLUMN rating_simple_stats TO rating_simple_stats_deprecated;
```

## Performance Considerations

### Indexing Strategy

- Index on `rating_simple` for filtering
- Partial index excluding NULLs for efficiency
- Consider composite index for (bottleId, rating_simple)

### Caching

- Cache `ratingSimpleStats` in Redis
- Invalidate on new tastings
- TTL: 5 minutes for active bottles

### Query Optimization

- Use materialized views for popular bottles
- Batch stats updates in worker jobs
- Consider read replicas for analytics

## Analytics and Monitoring

### Key Metrics

```typescript
interface RatingSystemMetrics {
  adoptionRate: number; // % of new tastings using simple
  conversionRate: number; // % of users who've tried simple
  systemPreference: {
    stars: number;
    simple: number;
    both: number;
  };
  ratingDistribution: {
    pass: number;
    sip: number;
    savor: number;
  };
}
```

### Tracking Events

- `rating.system.selected` - User chooses rating system
- `rating.simple.submitted` - Simple rating created
- `rating.system.toggled` - User switches systems
- `rating.simple.viewed` - User views simple ratings

## Security Considerations

- Validate rating values server-side
- Rate limit rating submissions
- Audit log rating changes
- Prevent rating manipulation via duplicate accounts
