#!/bin/sh
set -e

echo "Wachten op database..."
sleep 2

echo "Database migraties uitvoeren..."
./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "App starten..."
exec npm start
