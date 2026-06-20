import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createMemoryState } from "@chat-adapter/state-memory";
import { extractTikTokUrls, downloadTikTok } from "./tiktok";

// ─── Lazy singleton ───────────────────────────────────────────────────────────
// We build the bot lazily (on first request) so that the adapter does not
// validate env vars at module-load / build time.

let _bot: Chat<{ telegram: ReturnType<typeof createTelegramAdapter> }> | null =
  null;

export function getBot() {
  if (_bot) return _bot;

  _bot = new Chat({
    userName: process.env.TELEGRAM_BOT_USERNAME ?? "tiktokbot",
    adapters: {
      telegram: createTelegramAdapter(),
    },
    state: createMemoryState(),
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  type BotThread = Parameters<Parameters<typeof _bot.onNewMessage>[1]>[0];
  type BotMessage = Parameters<Parameters<typeof _bot.onNewMessage>[1]>[1];

  async function handleMessage(thread: BotThread, message: BotMessage) {
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
          "Sorry, I couldn't download that video. It may be private, geo-restricted, or too large (50 MB limit)."
        );
      }
    }
  }

  /**
   * Catch any message in an unsubscribed thread that contains a TikTok URL.
   * This covers groups, supergroups (including t.me/group/519 topic threads),
   * channel posts the bot is admin of, etc.
   */
  const TIKTOK_PATTERN =
    /https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)[^\s<>"']*/i;

  _bot.onNewMessage(TIKTOK_PATTERN, async (thread, message) => {
    await handleMessage(thread, message);
  });

  /** TikTok links sent as direct messages / private chats. */
  _bot.onDirectMessage(async (thread, message) => {
    await handleMessage(thread, message);
  });

  /** When someone @-mentions the bot together with a TikTok link. */
  _bot.onNewMention(async (thread, message) => {
    await handleMessage(thread, message);
  });

  return _bot;
}
