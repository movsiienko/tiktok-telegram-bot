import { getBot } from "@/lib/bot";

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  // Clone request so we can read the body for logging if needed
  const rawBody = await request.text();

  // Parse the Telegram update to extract chat_id for direct error reporting
  let chatId: number | string | undefined;
  try {
    const update = JSON.parse(rawBody) as {
      message?: { chat?: { id: number }; text?: string };
      channel_post?: { chat?: { id: number }; text?: string };
    };
    chatId =
      update.message?.chat?.id ??
      update.channel_post?.chat?.id;
  } catch { /* ignore parse errors */ }

  // Reconstruct a Request with the already-consumed body
  const newRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: rawBody,
  });

  try {
    const bot = getBot();
    const response = await bot.webhooks.telegram(newRequest);
    return response;
  } catch (err) {
    const msg = err instanceof Error
      ? `${err.message}\n${err.stack?.slice(0, 300) ?? ""}`
      : String(err);

    console.error("Webhook top-level error:", msg);

    // Send the error to the user's chat so we can see it in Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🔴 Bot error:\n${msg.slice(0, 3000)}`,
        }),
      }).catch(() => {});
    }

    // Always return 200 to Telegram so it doesn't retry
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
}
