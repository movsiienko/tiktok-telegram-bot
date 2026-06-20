#!/usr/bin/env bash
set -euo pipefail

WEBHOOK_URL="https://tiktok-telegram-bot.vercel.app/api/webhooks/telegram"

# Source the already-pulled .env.webhook
# shellcheck disable=SC1091
source "$(dirname "$0")/../.env.webhook"

RESPONSE=$(curl -s -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET_TOKEN}\",
    \"allowed_updates\": [\"message\", \"channel_post\", \"edited_message\", \"edited_channel_post\"]
  }")

rm -f "$(dirname "$0")/../.env.webhook"

echo "$RESPONSE" | python3 -c "
import sys, json
r = json.load(sys.stdin)
if r.get('ok'):
    print('Webhook registered:', r.get('description',''))
else:
    print('FAILED:', r)
    sys.exit(1)
"
