import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { extractTikTokUrls, downloadTikTok } from "./tiktok";

export const bot = new Chat({
  userName: process.env.TELEGRAM_BOT_USERNAME ?? "tiktokbot",
  adapters: {
    telegram: createTelegramAdapter(),
  },
});

// ─── Shared handler ──────────────────────────────────────────────────────────

async function handleMessage(
  thread: Parameters<Parameters<typeof bot.onNewMessage>[1]>[0],
  message: { text?: string }
) {
  const text = message.text ?? "";
  const urls = extractTikTokUrls(text);

  if (urls.length === 0) return;

  for (const url of urls) {
    try {
      await thread.post("⏬ Downloading TikTok video…");

      const { buffer, filename } = await downloadTikTok(url);

      await thread.post({
        markdown: "Here's your video:",
        files: [{ data: buffer, filename }],
      });
    } catch (err) {
      console.error("TikTok download error:", err);
      await thread.post(
        "Sorry, I couldn't download that video. It may be private, geo-restricted, or too large."
      );
    }
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Catch any message in an unsubscribed thread that contains a TikTok URL.
 * This covers:
 *  - Group / supergroup messages (including topic threads like t.me/group/519)
 *  - Channel posts the bot is admin of
 *  - Any other chat type where the bot receives messages
 */
const TIKTOK_PATTERN =
  /https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)[^\s<>"']*/i;

bot.onNewMessage(TIKTOK_PATTERN, async (thread, message) => {
  await handleMessage(thread, message);
});

/**
 * Handle TikTok links sent in direct messages / private chats.
 */
bot.onDirectMessage(async (thread, message) => {
  await handleMessage(thread, message);
});

/**
 * Handle TikTok links when someone @-mentions the bot with a link.
 */
bot.onNewMention(async (thread, message) => {
  await handleMessage(thread, message);
});
