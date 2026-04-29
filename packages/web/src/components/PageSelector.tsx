import { useAppStore } from "../state/store.js";

export function PageSelector() {
  const bundle = useAppStore((s) => s.bundle);
  const pageId = useAppStore((s) => s.pageId);
  const setPage = useAppStore((s) => s.setPage);

  if (!bundle) return null;
  const pages =
    "children" in bundle.document ? (bundle.document.children ?? []) : [];

  return (
    <div style={{ padding: "8px 12px", borderBottom: "1px solid #333", background: "#252525" }}>
      <label style={{ fontSize: 12, color: "#aaa", marginRight: 8 }}>Page</label>
      <select
        value={pageId ?? ""}
        onChange={(e) => setPage(e.target.value || null)}
        style={{
          background: "#1a1a1a",
          color: "#e6e6e6",
          border: "1px solid #444",
          padding: "4px 8px",
          borderRadius: 4,
        }}
      >
        {pages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <span style={{ marginLeft: 16, fontSize: 12, color: "#888" }}>
        {bundle.name}
        {bundle.lastModified ? ` · ${new Date(bundle.lastModified).toLocaleString()}` : ""}
      </span>
    </div>
  );
}
