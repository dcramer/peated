#!/bin/bash

echo "=== Recovery Progress Tracker ==="
echo

echo "✓ RECOVERED FILES:"
echo "  - flights.\$flightId.tsx"
echo "  - entities.\$entityId.merge.tsx"
echo "  - users.\$username.tsx"
echo "  - entities.\$entityId.tsx"
echo "  - locations.\$countrySlug.tsx"
echo "  - tastings.\$tastingId.tsx"
echo "  - bottles.\$bottleId.tsx"
echo "  - entities.\$entityId.bottles.tsx"
echo "  - bottles.\$bottleId.tastings.tsx"
echo "  - admin.badges.\$badgeId.tsx"
echo "  - badges.\$badgeId.tsx"
echo

echo "🔍 REMAINING CANDIDATES (by pattern):"
echo

# Look for remaining bottle-related files
echo "BOTTLE FILES:"
./recovery_matcher.sh | grep -A 15 "bottles" | grep -E "recovery/|Route patterns:" | head -10

echo
echo "ENTITY FILES:"
./recovery_matcher.sh | grep -A 15 "entities" | grep -E "recovery/|Route patterns:" | head -10

echo
echo "ADMIN FILES:"
./recovery_matcher.sh | grep -A 15 "admin" | grep -E "recovery/|Route patterns:" | head -10 
