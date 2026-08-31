import Link from "next/link";

export default function AdminHomePage() {
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
        <h1 style={{ marginTop: 0 }}>后台总览</h1>
        <p style={{ marginBottom: 0, color: "#4b5563", lineHeight: 1.7 }}>
          当前已经完成管理台基础骨架，并优先打通了资源接入主链路。下一步会继续往
          内容中心、订单、代理和风控结算模块扩展。
        </p>
      </section>

      <section
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16
        }}
      >
        <article
          style={{
            padding: 20,
            borderRadius: 16,
            background: "#fff",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 20 }}>资源中心</h2>
          <p style={{ color: "#4b5563", lineHeight: 1.7 }}>
            查看云转码资源、执行远端同步、刷新签名 URL、检查入库状态。
          </p>
          <Link href="/resources">进入资源中心</Link>
        </article>

        <article
          style={{
            padding: 20,
            borderRadius: 16,
            background: "#fff",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 20 }}>当前开发状态</h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: "#4b5563", lineHeight: 1.8 }}>
            <li>API 资源接入模块已可编译</li>
            <li>Prisma 模型和迁移文件已就位</li>
            <li>后台资源中心页面开始落地</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
