/**
 * One-time webhook registration endpoint.
 * Call POST /api/setup-webhook from any HTTP client.
 * The bot token never leaves Vercel's servers.
 *
 * Secured by a simple bearer check — set SETUP_SECRET to any random string
 * in Vercel env vars, then call:
 *   curl -X POST https://tiktok-telegram-bot.vercel.app/api/setup-webhook \
 *        -H "Authorization: Bearer YOUR_SETUP_SECRET"
 */

export const runtime = "edge";

const WEBHOOK_URL =
  "https://tiktok-telegram-bot.vercel.app/api/webhooks/telegram";

export async function POST(request: Request): Promise<Response> {
  // Simple auth guard so random people can't trigger this
  const auth = request.headers.get("authorization") ?? "";
  const setupSecret = process.env.SETUP_SECRET ?? "";

  if (!setupSecret || auth !== `Bearer ${setupSecret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;

  if (!botToken) {
    return new Response(
      JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not set" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const resp = await fetch(
    `https://api.telegram.org/bot${botToken}/setWebhook`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        secret_token: webhookSecret,
        allowed_updates: [
          "message",
          "channel_post",
          "edited_message",
          "edited_channel_post",
        ],
      }),
    }
  );

  const result = (await resp.json()) as { ok: boolean; description?: string };

  return new Response(
    JSON.stringify({
      ok: result.ok,
      description: result.description,
      webhook_url: WEBHOOK_URL,
    }),
    {
      status: result.ok ? 200 : 500,
      headers: { "content-type": "application/json" },
    }
  );
}
