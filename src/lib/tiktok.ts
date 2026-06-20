import { execFile } from "child_process";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const TIKTOK_REGEX =
  /https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)[^\s<>"']*/gi;

/**
 * Extract all TikTok URLs from a string.
 */
export function extractTikTokUrls(text: string): string[] {
  const matches = text.match(TIKTOK_REGEX);
  return matches ?? [];
}

/**
 * Check whether a string contains at least one TikTok URL.
 */
export function hasTikTokUrl(text: string): boolean {
  return TIKTOK_REGEX.test(text);
}

export interface DownloadResult {
  buffer: Buffer;
  filename: string;
}

/**
 * Download a TikTok video using yt-dlp and return it as a Buffer.
 * Falls back to sending only the URL if download fails.
 */
export async function downloadTikTok(url: string): Promise<DownloadResult> {
  const outputPath = join("/tmp", `tiktok-${Date.now()}-%(id)s.%(ext)s`);
  const resolvedTemplate = join("/tmp", `tiktok-${Date.now()}`);

  // Resolve yt-dlp binary — prefer the one shipped with yt-dlp-wrap,
  // but fall back to whatever is on PATH.
  let ytDlpBin = "yt-dlp";
  try {
    // yt-dlp-wrap bundles a binary path helper
    const wrap = await import("yt-dlp-wrap");
    const WrapClass = wrap.default ?? wrap;
    const instance = new WrapClass();
    ytDlpBin = (instance as { ytDlpBinaryPath?: string }).ytDlpBinaryPath ?? "yt-dlp";
  } catch {
    // ignore — fall back to PATH yt-dlp
  }

  const actualOutput = `${resolvedTemplate}.mp4`;

  await execFileAsync(ytDlpBin, [
    url,
    "-o",
    `${resolvedTemplate}.%(ext)s`,
    "--format",
    "mp4/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "--merge-output-format",
    "mp4",
    "--no-playlist",
    "--max-filesize",
    "49m", // keep safely under Telegram's 50 MB bot limit
    "--no-warnings",
    "--quiet",
  ]);

  const buffer = await readFile(actualOutput);
  await unlink(actualOutput).catch(() => {});

  return { buffer, filename: "tiktok.mp4" };
}
