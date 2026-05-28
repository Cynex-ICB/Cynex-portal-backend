#!/bin/bash
set -e

echo "Deploying application..."

# Check if required environment variables are set
if [ -z "$APP_PATH" ] || [ -z "$PM2_PROCESS_NAME" ]; then
  echo "Error: APP_PATH or PM2_PROCESS_NAME not set"
  exit 1
fi

cd "$APP_PATH"

# Pull latest code
git fetch origin
git reset --hard origin/main

# Install dependencies
npm ci --production

# Restart or start PM2 process
if pm2 list | grep -q "$PM2_PROCESS_NAME"; then
  echo "Restarting existing PM2 process: $PM2_PROCESS_NAME"
  pm2 restart "$PM2_PROCESS_NAME"
else
  echo "Starting new PM2 process: $PM2_PROCESS_NAME"
  pm2 start server.js --name "$PM2_PROCESS_NAME"
  pm2 save
fi

# Show status
pm2 show "$PM2_PROCESS_NAME"

echo "Deployment completed successfully."