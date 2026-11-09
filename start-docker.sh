#!/usr/bin/env bash
set -e

echo "=============================================="
echo "Starting reader-flash in Docker..."
echo "=============================================="

docker compose up -d --build

echo "=============================================="
echo "reader-flash started successfully!"
echo "Access reader-flash at: http://localhost:8090"
echo "Default admin credentials: admin / admin"
echo "=============================================="
