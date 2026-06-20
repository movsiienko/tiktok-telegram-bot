import { bot } from "@/lib/bot";

// Allow the function up to 60 seconds — needed for yt-dlp download + upload
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  return bot.webhooks.telegram(request);
}
