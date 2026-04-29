import { useState, type ChangeEvent, type FormEvent } from "react";
import { useAppStore } from "../state/store.js";
import { loadFromApi, loadFromLocalFile } from "../api.js";

export function SourcePanel() {
  const setBundle = useAppStore((s) => s.setBundle);
  const setLoading = useAppStore((s) => s.setLoading);
  const setError = useAppStore((s) => s.setError);
  const setStoreToken = useAppStore((s) => s.setToken);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);

  const [fileKey, setFileKey] = useState("");
  const [token, setToken] = useState("");

  const handleApi = async (e: FormEvent) => {
    e.preventDefault();
    if (!fileKey || !token) return;
    setLoading(true);
    setError(null);
    try {
      const bundle = await loadFromApi(fileKey.trim(), token.trim());
      setBundle(bundle);
      // Retain the token in memory so the compare feature can reuse it for
      // /api/figma/export without re-prompting. Never persisted to storage.
      setStoreToken(token.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const bundle = await loadFromLocalFile(file);
      setBundle(bundle);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <div style={panelStyle}>
      <h2 style={{ margin: "0 0 12px", fontSize: 14 }}>Load Figma file</h2>
      <form onSubmit={handleApi} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={labelStyle}>
          File key
          <input
            value={fileKey}
            onChange={(e) => setFileKey(e.target.value)}
            placeholder="abc123XYZ"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Personal access token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="figd_..."
            style={inputStyle}
          />
        </label>
        <button type="submit" disabled={loading || !fileKey || !token} style={buttonStyle}>
          {loading ? "Loading..." : "Fetch from API"}
        </button>
      </form>
      <hr style={{ margin: "16px 0", borderColor: "#333" }} />
      <label style={{ ...labelStyle, cursor: "pointer" }}>
        Or load local file (.fig / .figma / .json)
        <input
          type="file"
          accept=".fig,.figma,.json,application/json"
          onChange={handleFile}
          style={{ marginTop: 6 }}
        />
      </label>
      {error && <p style={{ color: "#ff7b72", marginTop: 12, fontSize: 12 }}>{error}</p>}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  width: 280,
  padding: 16,
  background: "#252525",
  borderRight: "1px solid #333",
  overflowY: "auto",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
  color: "#aaa",
};

const inputStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #444",
  color: "#e6e6e6",
  padding: "6px 8px",
  borderRadius: 4,
};

const buttonStyle: React.CSSProperties = {
  background: "#0d6efd",
  color: "white",
  border: "none",
  padding: "8px 12px",
  borderRadius: 4,
  cursor: "pointer",
};
