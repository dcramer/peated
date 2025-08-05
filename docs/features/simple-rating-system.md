# Simple Rating System (Pass/Sip/Savor)

## Overview

Peated has implemented a new simplified rating system to replace the traditional 5-star rating scale. This whisky-themed system reduces cognitive load while maintaining meaningful feedback about user preferences.

**Important**: The 5-star rating system has been deprecated. Existing 5-star ratings are preserved in the `rating_legacy` field, and all new tastings use the simplified Pass/Sip/Savor system.

## The Three-Point Scale

### 🚫 Pass (-1)

**"Would not drink again"**

- Indicates a negative experience
- The whisky didn't meet expectations
- User would decline if offered again

### 🥃 Sip (1)

**"Enjoyable, would have occasionally"**

- Positive experience
- Good whisky worth trying
- Would happily accept if offered
- Might order at a bar

### 🥃🥃 Savor (2)

**"Excellent, would seek out"**

- Exceptional experience
- Whisky worth pursuing
- Would purchase a bottle
- Would recommend to others

## Why We're Adding This System

### User Benefits

1. **Faster Decisions**: No agonizing over 3.5 vs 3.75 stars
2. **Clearer Intent**: Each rating has distinct meaning
3. **Mobile-Friendly**: Easy to tap on small screens
4. **More Ratings**: Simplified systems see 200%+ increase in engagement (Netflix case study)

### Platform Benefits

1. **Better Recommendations**: Clearer positive/negative signals
2. **Improved Analytics**: Easier to identify crowd favorites
3. **Social Features**: "85% would savor" is more meaningful than "4.2 stars"

## How It Works

### For New Tastings

1. When creating a tasting, users see three whisky-themed rating options
2. Users select their choice: Pass 🚫, Sip 🥃, or Savor 🥃🥃
3. The selection is highlighted and saved with numerical values (-1, 1, 2)

### For Existing Tastings

- All existing 5-star ratings are preserved in `rating_legacy` field
- Legacy ratings were automatically converted using thresholds:
  - Pass (-1): rating ≤ 2.0
  - Sip (1): rating > 2.0 and ≤ 4.0
  - Savor (2): rating > 4.0

### Display Examples

#### Individual Tasting

```
Ardbeg Corryvreckan
🥃🥃 Savor
"Intense peat bomb with complex maritime notes..."
```

#### Bottle Overview

```
Lagavulin 16
⭐⭐⭐⭐½ 4.3 (847 ratings)
🥃 78% would sip or savor (234 simple ratings)
```

#### Distribution Display

```
Pass:  ▓▓░░░░░░░░ 15%
Sip:   ▓▓▓▓▓░░░░░ 45%
Savor: ▓▓▓▓░░░░░░ 40%
```

## User Experience Flow

### Creating a Tasting

1. User selects bottle and enters tasting details
2. Sees "Rating" section with toggle
3. Default shows based on user's last preference
4. Can switch between systems before saving

### Viewing Ratings

- Bottle pages show both rating types if available
- List views display primary rating (most ratings)
- Filters support both systems

### Search and Discovery

- Can filter by minimum simple rating
- Sort by simple rating average
- "Highly Savored" badge for 80%+ savor rate

## Implementation Details

### Database Schema

- **Tastings table**: `rating` column changed to smallint (-1, 1, 2), `rating_legacy` preserves original values
- **Bottles table**: `ratingStats` JSONB field stores distribution statistics
- **Automatic migration**: Existing ratings converted using defined thresholds

### Components

- **SimpleRatingInput**: Interactive rating selector for tasting forms
- **SimpleRatingStats**: Visual distribution display with percentages and bars
- **SimpleRatingDisplay**: Consistent rating display with icons and labels
- **SimpleRatingFilter**: Bottle list filtering by rating level

## FAQs

**Q: Will my old ratings be converted?**
A: Your existing 5-star ratings will be preserved and remain visible. We'll offer an optional tool to convert them to the new system if you wish.

**Q: Can I still use the 5-star system?**
A: During the transition period, yes. However, we're deprecating 5-star ratings in favor of the simpler system.

**Q: How does this affect bottle rankings?**
A: During transition, bottles will show both rating types. Eventually, rankings will be based solely on the new system.

**Q: Why are you deprecating 5-star ratings?**
A: Our research shows simplified systems increase engagement by 200%+ and provide clearer signals for recommendations.

**Q: What if I'm neutral about a whisky?**
A: You can choose not to rate, or use "Sip" for acceptable but unremarkable whiskies.

## Future Enhancements

- **Contextual Ratings**: "Would sip neat, would savor with water"
- **Occasion Tags**: "Daily sipper" vs "Special occasion savor"
- **Price Context**: "Would savor at $50, would sip at $100"
- **Recommendation Weights**: Savor ratings influence recommendations more strongly
