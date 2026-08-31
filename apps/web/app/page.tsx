import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <section
        style={{
          padding: 24,
          borderRadius: 16,
          background: "#fff",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
        }}
      >
        <h1 style={{ marginTop: 0 }}>前台站点</h1>
        <p style={{ color: "#4b5563", lineHeight: 1.8 }}>
          当前已经接通最小播放链路：前台播放页会调用 API 的
          `playback-authorize`，拿到临时播放地址后直接尝试播放 HLS 视频。
        </p>
        <p style={{ color: "#4b5563", lineHeight: 1.8 }}>
          你可以手动输入一个已完成同步的 `cloudVid` 进入播放测试页面。
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link href="/content" style={{ color: "#2563eb" }}>
            进入内容目录
          </Link>
          <Link href="/play" style={{ color: "#2563eb" }}>
            进入播放测试页
          </Link>
          <Link href="/me" style={{ color: "#2563eb" }}>
            进入用户中心
          </Link>
        </div>
      </section>
    </main>
  );
}
