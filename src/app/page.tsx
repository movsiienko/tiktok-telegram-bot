export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        gap: "12px",
        color: "#111",
      }}
    >
      <h1 style={{ fontSize: "2rem", margin: 0 }}>🎵 TikTok Telegram Bot</h1>
      <p style={{ color: "#555", margin: 0 }}>
        Send any TikTok link to the bot in Telegram and it will reply with the
        video file.
      </p>
    </main>
  );
}
