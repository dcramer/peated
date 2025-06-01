#!/bin/bash
cd .git/lost-found/other
FILES=*
COUNTER=0
for f in $FILES do
   echo "Processing $f file..."
   git show $f > "PATH_TO_RECOVERY_DIRECTORY/$COUNTER.m"
done
