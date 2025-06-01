#!/bin/bash

echo "=== TanStack Router File Recovery Matcher ==="
echo

# Check each recovery file for TanStack Router patterns
for file in recovery/*; do
    if [ -f "$file" ]; then
        # Skip large files that are likely not route components
        size=$(wc -c < "$file")
        if [ $size -gt 50000 ]; then
            continue
        fi
        
        # Check if it contains TanStack Router imports
        if grep -q "createFileRoute\|@tanstack/react-router" "$file" 2>/dev/null; then
            echo "=== $file ==="
            
            # Extract key identifiers
            echo "Params used:"
            grep -o "params\.[a-zA-Z]*\|useParams.*[a-zA-Z]*Id\|Route\.useParams" "$file" 2>/dev/null | sort -u | head -3
            
            echo "Components imported:"
            grep -o "import.*from.*components/[a-zA-Z]*" "$file" 2>/dev/null | sed 's/.*\///' | head -3
            
            echo "Key content indicators:"
            grep -o "TastingList\|BottleTable\|EntityTable\|EntityMap\|FlightTable\|UserTable" "$file" 2>/dev/null | head -3
            
            echo "Route patterns:"
            grep -o "entities\|bottles\|tastings\|users\|flights\|badges\|locations\|admin" "$file" 2>/dev/null | sort -u | head -3
            
            echo "First few lines:"
            head -5 "$file" 2>/dev/null
            
            echo "---"
        fi
    fi
done 
