#!/bin/sh
set -e

cd /app
npx prisma migrate deploy

cd /app/apps/api
exec "$@"
