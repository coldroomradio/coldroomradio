#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Cold Room Radio episode publisher..."
node scripts/publish-server.mjs
