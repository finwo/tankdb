#!/usr/bin/env bash

# Ensure we're in the right wd
cd $(dirname $0)

# Indents input by 5
function indent() {
  while IFS= read line; do
    echo "     $line"
  done
}

# Ensure clean start
rm -rf ../data/

# Start
echo " --> Starting server"
node server | indent &
sleep 1
echo " --> Starting client"
node client | indent &

# Wait for client, kill server
echo " --> Awaiting client exit"
wait %2
echo " --> Killing server"
kill %1
