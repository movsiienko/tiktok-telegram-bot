const TIKTOK_REGEX =
  /https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)[^\s<>"']*/gi;

export function extractTikTokUrls(text: string): string[] {
  // Reset lastIndex since we reuse the regex
  TIKTOK_REGEX.lastIndex = 0;
  return text.match(TIKTOK_REGEX) ?? [];
}

export interface DownloadResult {
  buffer: Buffer;
  filename: string;
}

interface TikwmResponse {
  code: number;
  msg: string;
  data?: {
    id: string;
    title: string;
    play: string;       // no-watermark MP4 URL
    wmplay: string;     // watermarked URL
    hdplay: string;     // HD no-watermark URL
    size: number;
    duration: number;
  };
}

/**
 * Resolve a TikTok URL to a direct MP4 download link via tikwm.com,
 * then stream it into a Buffer. No binary dependencies required.
 */
export async function downloadTikTok(url: string): Promise<DownloadResult> {
  // Step 1: get metadata + no-watermark URL from tikwm API
  const apiUrl = new URL("https://www.tikwm.com/api/");
  apiUrl.searchParams.set("url", url);
  apiUrl.searchParams.set("hd", "1");

  const metaRes = await fetch(apiUrl.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; TikTok-Telegram-Bot/1.0)",
    },
    // short redirect chain for vm.tiktok.com links
    redirect: "follow",
  });

  if (!metaRes.ok) {
    throw new Error(`tikwm API returned HTTP ${metaRes.status}`);
  }

  const meta: TikwmResponse = await metaRes.json();

  if (meta.code !== 0 || !meta.data) {
    throw new Error(`tikwm error: ${meta.msg ?? "unknown"}`);
  }

  // Prefer HD no-watermark, fall back to standard no-watermark
  const videoUrl = meta.data.hdplay || meta.data.play;

  if (!videoUrl) {
    throw new Error("No download URL returned by tikwm");
  }

  // Step 2: download the actual video bytes
  const videoRes = await fetch(videoUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; TikTok-Telegram-Bot/1.0)",
      Referer: "https://www.tiktok.com/",
    },
    redirect: "follow",
  });

  if (!videoRes.ok) {
    throw new Error(`Video download returned HTTP ${videoRes.status}`);
  }

  const arrayBuffer = await videoRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Sanitise title for filename
  const safeTitle = (meta.data.title ?? "tiktok")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);

  return { buffer, filename: `${safeTitle || "tiktok"}.mp4` };
}
