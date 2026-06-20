/**
 * Debug endpoint: POST /api/debug-webhook
 * Accepts the same Telegram update payload and logs it,
 * then manually runs the TikTok handler logic step by step.
 * Protected by SETUP_SECRET.
 */
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization") ?? "";
  const setupSecret = process.env.SETUP_SECRET ?? "";
  if (!setupSecret || auth !== `Bearer ${setupSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { url?: string; chat_id?: string | number };
  const { url, chat_id } = body;

  if (!url || !chat_id) {
    return Response.json({ error: "Need url and chat_id in body" }, { status: 400 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Response.json({ error: "No TELEGRAM_BOT_TOKEN" }, { status: 500 });

  const steps: Record<string, unknown> = {};

  // Step 1: tikwm API
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const metaRes = await fetch(apiUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const meta = await metaRes.json() as { code: number; msg: string; data?: { hdplay?: string; play?: string; size?: number } };
    steps.tikwm = { code: meta.code, msg: meta.msg, hasData: !!meta.data, size: meta.data?.size };

    if (meta.code !== 0 || !meta.data) {
      return Response.json({ steps, error: "tikwm failed" });
    }

    const videoUrl = meta.data.hdplay || meta.data.play || "";
    steps.videoUrl = videoUrl.slice(0, 60) + "…";

    // Step 2: download video
    const videoRes = await fetch(videoUrl, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.tiktok.com/" }
    });
    steps.videoStatus = videoRes.status;
    const buf = Buffer.from(await videoRes.arrayBuffer());
    steps.bufferBytes = buf.length;

    // Step 3: send via Telegram sendVideo
    const form = new FormData();
    form.append("chat_id", String(chat_id));
    form.append("video", new Blob([new Uint8Array(buf)], { type: "video/mp4" }), "tiktok.mp4");
    form.append("supports_streaming", "true");

    const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
      method: "POST",
      body: form,
    });
    const sendJson = await sendRes.json();
    steps.sendVideoStatus = sendRes.status;
    steps.sendVideoOk = (sendJson as { ok?: boolean }).ok;
    steps.sendVideoDesc = (sendJson as { description?: string }).description;

  } catch (err) {
    steps.error = String(err);
  }

  return Response.json({ steps });
}
