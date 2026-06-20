#!/usr/bin/env bash
# Registers the Telegram webhook without ever printing the bot token.
# Requires: VERCEL_TOKEN env var and the Vercel CLI on PATH.
set -euo pipefail

SCOPE="ovsiienko-xyz"
PROJECT="tiktok-telegram-bot"
WEBHOOK_URL="https://tiktok-telegram-bot.vercel.app/api/webhooks/telegram"

echo "Pulling env vars from Vercel…"

# Pull encrypted env vars into a local .env.webhook (git-ignored)
npx vercel env pull .env.webhook \
  --token "$VERCEL_TOKEN" \
  --scope "$SCOPE" \
  --yes 2>/dev/null

# Source the file so vars are available in this shell
# shellcheck disable=SC1091
source .env.webhook

# Verify required vars are present (values not printed)
if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  echo "ERROR: TELEGRAM_BOT_TOKEN not found in pulled env vars." >&2
  rm -f .env.webhook
  exit 1
fi
if [[ -z "${TELEGRAM_WEBHOOK_SECRET_TOKEN:-}" ]]; then
  echo "ERROR: TELEGRAM_WEBHOOK_SECRET_TOKEN not found in pulled env vars." >&2
  rm -f .env.webhook
  exit 1
fi

echo "Registering webhook at: $WEBHOOK_URL"

RESPONSE=$(curl -s -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"secret_token\": \"${TELEGRAM_WEBHOOK_SECRET_TOKEN}\",
    \"allowed_updates\": [\"message\", \"channel_post\", \"edited_message\", \"edited_channel_post\"]
  }")

# Clean up pulled secrets immediately
rm -f .env.webhook

# Show result without leaking the token
echo "$RESPONSE" | python3 -c "
import sys, json
r = json.load(sys.stdin)
if r.get('ok'):
    print('✅ Webhook registered successfully!')
    print('   Description:', r.get('description', ''))
else:
    print('❌ Failed to register webhook')
    print('   Error:', r.get('description', r))
    sys.exit(1)
"
