#!/usr/bin/env bash
set -euo pipefail

TARGET_URL="${PROD_URL:-http://127.0.0.1:8000}"

echo "💥 [ProdPilot] Triggering intentional crash on $TARGET_URL..."
echo "Sending POST /orders without required 'discount' key..."

# Send order without discount field to trigger KeyError: 'discount'
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$TARGET_URL/orders" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"id": "p1", "qty": 2, "price": 25.0}]}' || true)

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS" || true)

echo "Response HTTP Status: $HTTP_CODE"
echo "Response Body: $BODY"

echo "Verifying healthcheck degradation..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL/health" || echo "FAILED")
echo "Healthcheck status code: $HEALTH_STATUS"

if [ "$HEALTH_STATUS" = "500" ] || [ "$HEALTH_STATUS" = "000" ] || [ "$HEALTH_STATUS" = "FAILED" ]; then
    echo "🚨 Healthcheck failed as expected! Service is now degraded/unhealthy."
    exit 0
else
    echo "⚠️ Warning: Healthcheck returned $HEALTH_STATUS. Expected 500 or unreachable."
    exit 1
fi
