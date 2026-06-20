# TikTok Telegram Bot

A Telegram bot that automatically detects TikTok links in messages, downloads the video, and sends it back to the same chat as a file attachment.

Built with [Chat SDK](https://chat-sdk.dev) and deployed on Vercel.

---

## How it works

1. Add the bot to a group/channel **or** send it a DM
2. Post any TikTok link (e.g. `https://www.tiktok.com/@user/video/123`, `https://vm.tiktok.com/XXX/`)
3. The bot downloads the video and replies with the `.mp4` file

Works with:
- Private chats / DMs
- Groups and supergroups
- Channel posts (add the bot as admin)
- Supergroup topic threads (like `t.me/group/519` style links)

---

## Setup

### 1. Create a Telegram bot

1. Open [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the **bot token** you receive
4. Send `/setprivacy` → select your bot → choose **Disable** so the bot can read all group messages (not just commands)

### 2. Environment variables

Copy `.env.example` to `.env.local` for local dev:

```sh
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | Random secret for webhook verification — generate with `openssl rand -hex 32` |
| `TELEGRAM_BOT_USERNAME` | Your bot's @username **without** the `@` (e.g. `mytiktokbot`) |

### 3. Deploy to Vercel

1. Push this repo to GitHub
2. Import the project in [Vercel](https://vercel.com/new)
3. Add the three environment variables above in the Vercel project settings
4. Deploy

### 4. Register the Telegram webhook

After deploying, run this once to point Telegram at your Vercel URL:

```sh
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR-PROJECT.vercel.app/api/webhooks/telegram",
    "secret_token": "YOUR_TELEGRAM_WEBHOOK_SECRET_TOKEN"
  }'
```

Replace `YOUR-PROJECT.vercel.app` with your actual Vercel domain and fill in the real token values.

### 5. Using the bot in channels

To use the bot in a Telegram channel (so it can receive channel posts):

1. Open the channel settings → Administrators
2. Add your bot as an administrator
3. Enable the **"Post Messages"** permission

Now every post in the channel that contains a TikTok link will be automatically downloaded and reposted as a video.

---

## Local development

```sh
npm install
npm run dev
```

For local testing with Telegram webhooks, use [ngrok](https://ngrok.com/):

```sh
ngrok http 3000
# then register the webhook with your ngrok URL
```

---

## Tech stack

- [Next.js 15](https://nextjs.org/) — App Router, serverless API routes
- [Chat SDK](https://chat-sdk.dev) — Telegram adapter (`@chat-adapter/telegram`)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — Video download engine
- [Vercel](https://vercel.com) — Hosting
