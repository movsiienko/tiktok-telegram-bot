import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createMemoryState } from "@chat-adapter/state-memory";
import { extractTikTokUrls, downloadTikTok } from "./tiktok";

let _bot: Chat<{ telegram: ReturnType<typeof createTelegramAdapter> }> | null = null;

// ── Direct Telegram API helpers ───────────────────────────────────────────────

async function tgPost(method: string, body: Record<string, unknown>): Promise<Response> {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  return fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sendText(chatId: number | string, text: string, replyTo?: number) {
  return tgPost("sendMessage", {
    chat_id: chatId,
    text,
    ...(replyTo ? { reply_to_message_id: replyTo } : {}),
  });
}

async function sendVideo(
  chatId: number | string,
  buffer: Buffer,
  filename: string,
  replyTo?: number
) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("video", new Blob([new Uint8Array(buffer)], { type: "video/mp4" }), filename);
  form.append("supports_streaming", "true");
  if (replyTo) form.append("reply_to_message_id", String(replyTo));

  return fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
    method: "POST",
    body: form,
  });
}

async function deleteMsg(chatId: number | string, messageId: number) {
  return tgPost("deleteMessage", { chat_id: chatId, message_id: messageId });
}

// ── Bot factory ───────────────────────────────────────────────────────────────

export function getBot() {
  if (_bot) return _bot;

  _bot = new Chat({
    userName: process.env.TELEGRAM_BOT_USERNAME ?? "tiktokbot",
    adapters: { telegram: createTelegramAdapter() },
    state: createMemoryState(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyMsg = any;
  type BotThread = Parameters<Parameters<typeof _bot.onNewMessage>[1]>[0];

  // ── Extract chat_id and message_id from the raw Telegram payload ──
  function getRaw(message: AnyMsg): { chatId: number | string; msgId?: number } {
    const raw = message?.raw ?? {};
    // raw may be the message object directly, or wrapped under .message
    const chatId: number | string =
      raw?.chat?.id ??
      raw?.message?.chat?.id ??
      raw?.channel_post?.chat?.id ??
      0;
    const msgId: number | undefined =
      raw?.message_id ??
      raw?.message?.message_id ??
      raw?.channel_post?.message_id;
    return { chatId, msgId };
  }

  async function handleMessage(thread: BotThread, message: AnyMsg) {
    const text: string = message?.text ?? message?.raw?.text ?? "";
    const urls = extractTikTokUrls(text);
    if (urls.length === 0) return;

    const { chatId, msgId } = getRaw(message);

    // Fallback: use thread.id if raw extraction gives 0
    const effectiveChatId = chatId || thread.id;

    for (const url of urls) {
      // Send "Downloading…" acknowledgement
      let statusMsgId: number | undefined;
      try {
        const ackRes = await sendText(effectiveChatId, "⏬ Downloading…", msgId);
        if (ackRes.ok) {
          const ackJson = await ackRes.json() as { result?: { message_id?: number } };
          statusMsgId = ackJson.result?.message_id;
        }
      } catch (e) {
        console.error("ack send failed:", e);
      }

      try {
        const { buffer, filename } = await downloadTikTok(url);

        const sendRes = await sendVideo(effectiveChatId, buffer, filename, msgId);
        const sendJson = await sendRes.json() as { ok: boolean; description?: string };

        if (!sendJson.ok) {
          throw new Error(`sendVideo API error: ${sendJson.description}`);
        }

        // Clean up status message
        if (statusMsgId) {
          await deleteMsg(effectiveChatId, statusMsgId).catch(() => {});
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("TikTok handler error:", errMsg);
        await sendText(effectiveChatId, `❌ Failed: ${errMsg.slice(0, 500)}`).catch(() => {});
      }
    }
  }

  // ── /start → echo chat ID (useful for debugging) ──────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _bot.onNewMessage(/^\/start/, async (thread: BotThread, message: AnyMsg) => {
    const { chatId } = getRaw(message);
    const effectiveChatId = chatId || thread.id;
    await sendText(effectiveChatId, `👋 Send me a TikTok link!\n\nYour chat ID: ${effectiveChatId}`);
  });

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
