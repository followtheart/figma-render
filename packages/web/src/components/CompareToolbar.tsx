import { useAppStore } from "../state/store.js";
import { exportPng } from "../api.js";

/**
 * Compare-mode toolbar:
 * - mode: off / side-by-side / overlay
 * - opacity slider (overlay only)
 * - render scale (1x/2x/3x/4x sent to /v1/images)
 * - "Fetch PNG" button — pulls the currently selected node (or page root) via
 *   `/api/figma/export` and stores the signed URL under that node id.
 *
 * The toolbar gates fetching on (a) bundle has a real fileKey (not "local"),
 * and (b) a token has been entered earlier in the SourcePanel and retained
 * in memory by the store.
 */
export function CompareToolbar() {
  const bundle = useAppStore((s) => s.bundle);
  const pageId = useAppStore((s) => s.pageId);
  const selectedId = useAppStore((s) => s.selectedId);
  const token = useAppStore((s) => s.token);
  const compareMode = useAppStore((s) => s.compareMode);
  const compareOpacity = useAppStore((s) => s.compareOpacity);
  const compareScale = useAppStore((s) => s.compareScale);
  const compareImages = useAppStore((s) => s.compareImages);
  const compareLoading = useAppStore((s) => s.compareLoading);
  const compareError = useAppStore((s) => s.compareError);
  const setCompareMode = useAppStore((s) => s.setCompareMode);
  const setCompareOpacity = useAppStore((s) => s.setCompareOpacity);
  const setCompareScale = useAppStore((s) => s.setCompareScale);
  const setCompareImages = useAppStore((s) => s.setCompareImages);
  const setCompareLoading = useAppStore((s) => s.setCompareLoading);
  const setCompareError = useAppStore((s) => s.setCompareError);

  if (!bundle) return null;

  const targetId = selectedId ?? pageId;
  // Node ids that come from resolveInstance carry an override suffix like
  // ";I0" — strip it back to a real document id before asking Figma to render.
  const realId = targetId ? canonicalId(targetId) : null;
  const canFetch =
    !!realId && !!token && bundle.fileKey !== "local" && !compareLoading;

  const handleFetch = async () => {
    if (!realId || !token) return;
    setCompareLoading(true);
    setCompareError(null);
    try {
      const exports = await exportPng(bundle.fileKey, token, [realId], compareScale);
      // Merge so previously fetched images for other nodes survive.
      setCompareImages({ ...compareImages, ...exports });
    } catch (err) {
      setCompareError((err as Error).message);
    } finally {
      setCompareLoading(false);
    }
  };

  const currentImg = realId ? compareImages[realId] : undefined;

  return (
    <div style={barStyle}>
      <span style={labelStyle}>Compare:</span>
      <ModeButton
        active={compareMode === "off"}
        onClick={() => setCompareMode("off")}
        label="Off"
      />
      <ModeButton
        active={compareMode === "side"}
        onClick={() => setCompareMode("side")}
        label="Side"
      />
      <ModeButton
        active={compareMode === "overlay"}
        onClick={() => setCompareMode("overlay")}
        label="Overlay"
      />
      <div style={dividerStyle} />
      <label style={labelStyle}>
        Scale
        <select
          value={compareScale}
          onChange={(e) => setCompareScale(Number(e.target.value))}
          style={selectStyle}
        >
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={3}>3x</option>
          <option value={4}>4x</option>
        </select>
      </label>
      {compareMode === "overlay" && (
        <label style={labelStyle}>
          Opacity {Math.round(compareOpacity * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={compareOpacity}
            onChange={(e) => setCompareOpacity(Number(e.target.value))}
            style={{ width: 100 }}
          />
        </label>
      )}
      <div style={dividerStyle} />
      <button
        type="button"
        onClick={handleFetch}
        disabled={!canFetch}
        style={fetchBtnStyle}
        title={
          !token
            ? "Load a file via API first to retain a token"
            : bundle.fileKey === "local"
              ? "Compare unavailable for locally loaded JSON"
              : !realId
                ? "Select a node or page first"
                : currentImg
                  ? "Re-fetch PNG for the current target"
                  : "Fetch PNG from Figma for the current target"
        }
      >
        {compareLoading ? "Fetching..." : currentImg ? "Refresh PNG" : "Fetch PNG"}
      </button>
      {realId && (
        <span style={mutedStyle}>
          target: <code>{realId}</code>
          {currentImg ? " ✓" : ""}
        </span>
      )}
      {compareError && <span style={errStyle}>{compareError}</span>}
    </div>
  );
}

/** Strip the `;…` override suffix that resolveInstance appends to cloned ids. */
function canonicalId(id: string): string {
  const semi = id.indexOf(";");
  return semi === -1 ? id : id.slice(0, semi);
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...modeBtnStyle,
        background: active ? "#0d6efd" : "#2a2a2a",
        color: active ? "white" : "#ccc",
      }}
    >
      {label}
    </button>
  );
}

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px",
  background: "#1a1a1a",
  borderBottom: "1px solid #333",
  fontSize: 12,
  color: "#aaa",
  flexWrap: "wrap",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  color: "#aaa",
};

const modeBtnStyle: React.CSSProperties = {
  border: "1px solid #444",
  borderRadius: 4,
  padding: "3px 8px",
  fontSize: 12,
  cursor: "pointer",
};

const fetchBtnStyle: React.CSSProperties = {
  background: "#0d6efd",
  color: "white",
  border: "none",
  padding: "4px 10px",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 12,
};

const selectStyle: React.CSSProperties = {
  background: "#1a1a1a",
  color: "#e6e6e6",
  border: "1px solid #444",
  borderRadius: 3,
  padding: "2px 4px",
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 16,
  background: "#333",
  margin: "0 4px",
};

const mutedStyle: React.CSSProperties = {
  color: "#777",
  fontSize: 11,
};

const errStyle: React.CSSProperties = {
  color: "#ff7b72",
  fontSize: 11,
};
