import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createMemoryState } from "@chat-adapter/state-memory";
import { extractTikTokUrls, downloadTikTok } from "./tiktok";

let _bot: Chat<{ telegram: ReturnType<typeof createTelegramAdapter> }> | null =
  null;

/**
 * Send a video buffer directly via Telegram Bot API (multipart/form-data).
 * Bypasses chat-sdk for the file upload since the adapter's abstraction
 * for binary video uploads is unreliable.
 */
async function sendVideoToTelegram(
  chatId: string | number,
  buffer: Buffer,
  filename: string,
  caption?: string,
  replyToMessageId?: number
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append(
    "video",
    new Blob([new Uint8Array(buffer)], { type: "video/mp4" }),
    filename
  );
  if (caption) form.append("caption", caption);
  if (replyToMessageId)
    form.append("reply_to_message_id", String(replyToMessageId));
  // Let Telegram generate the thumbnail
  form.append("supports_streaming", "true");

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendVideo`,
    { method: "POST", body: form }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`sendVideo failed ${res.status}: ${err}`);
  }
}

export function getBot() {
  if (_bot) return _bot;

  _bot = new Chat({
    userName: process.env.TELEGRAM_BOT_USERNAME ?? "tiktokbot",
    adapters: { telegram: createTelegramAdapter() },
    state: createMemoryState(),
  });

  // We need access to the raw Telegram chat_id and message_id from the
  // incoming update. chat-sdk exposes them via message.raw (platform payload).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyMsg = any;
  type BotThread = Parameters<Parameters<typeof _bot.onNewMessage>[1]>[0];

  async function handleMessage(thread: BotThread, message: AnyMsg) {
    const text: string = message.text ?? "";
    const urls = extractTikTokUrls(text);
    if (urls.length === 0) return;

    // Extract chat_id and message_id from the raw Telegram payload
    // so we can call sendVideo directly and reply to the original message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = message.raw ?? {};
    const chatId: string | number =
      raw?.chat?.id ?? raw?.message?.chat?.id ?? thread.id;
    const messageId: number | undefined =
      raw?.message_id ?? raw?.message?.message_id;

    for (const url of urls) {
      // Send acknowledgement via chat-sdk (plain text — always works)
      let statusId: number | undefined;
      try {
        const token = process.env.TELEGRAM_BOT_TOKEN!;
        const ackRes = await fetch(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "⏬ Downloading…",
              ...(messageId ? { reply_to_message_id: messageId } : {}),
            }),
          }
        );
        if (ackRes.ok) {
          const ackJson = await ackRes.json() as { result?: { message_id?: number } };
          statusId = ackJson.result?.message_id;
        }
      } catch { /* non-critical */ }

      try {
        const { buffer, filename } = await downloadTikTok(url);

        await sendVideoToTelegram(chatId, buffer, filename, undefined, messageId);

        // Delete the "Downloading…" status message
        if (statusId) {
          const token = process.env.TELEGRAM_BOT_TOKEN!;
          await fetch(
            `https://api.telegram.org/bot${token}/deleteMessage`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, message_id: statusId }),
            }
          ).catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("TikTok handler error:", msg);

        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token) {
          await fetch(
            `https://api.telegram.org/bot${token}/sendMessage`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `❌ Failed to download: ${msg.slice(0, 200)}`,
              }),
            }
          ).catch(() => {});
        }
      }
    }
  }

  const TIKTOK_PATTERN =
    /https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)[^\s<>"']*/i;

  _bot.onNewMessage(TIKTOK_PATTERN, async (thread, message) => {
    await handleMessage(thread, message);
  });

  _bot.onDirectMessage(async (thread, message) => {
    await handleMessage(thread, message);
  });

  _bot.onNewMention(async (thread, message) => {
    await handleMessage(thread, message);
  });

  return _bot;
}
