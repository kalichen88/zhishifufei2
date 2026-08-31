import { AdminNav } from "../admin-nav";
import { AgentsClient } from "./agents-client";

export default function AgentsPage() {
  return (
    <main style={{ padding: 24, display: "grid", gap: 20 }}>
      <AdminNav />
      <h1 style={{ margin: 0 }}>代理管理</h1>
      <AgentsClient />
    </main>
  );
}
