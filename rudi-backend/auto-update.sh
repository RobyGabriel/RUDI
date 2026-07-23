#!/bin/bash
cd ~/RUDI
BEFORE=$(git rev-parse HEAD)
git pull origin main
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" != "$AFTER" ]; then
    echo "$(date): New changes detected, restarting service..."
    sudo systemctl restart rudi-backend
else
    echo "$(date): No changes."
fi
