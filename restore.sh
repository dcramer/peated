#!/bin/bash
cd ~/Users/dcramer/src/peated/.git/lost-found/other
FILES=*
COUNTER=0
for f in $FILES; do
   echo "Processing $f file..."
   git show $f > "~/Users/dcramer/src/peated/.git/lost-found/other/$COUNTER.m"
done
