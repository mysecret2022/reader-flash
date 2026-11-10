#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "=============================================="
echo "Starting reader-flash in Docker..."
echo "=============================================="

docker compose pull
docker compose up -d

echo "=============================================="
echo "reader-flash started successfully!"
echo "Access reader-flash at: http://localhost:8080"
echo "Default admin credentials: admin / admin"
echo "=============================================="
