import { SourcePanel } from "./components/SourcePanel.js";
import { PageSelector } from "./components/PageSelector.js";
import { Canvas } from "./components/Canvas.js";
import { NodeInspector } from "./components/NodeInspector.js";

export function App() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <SourcePanel />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <PageSelector />
        <Canvas />
      </div>
      <NodeInspector />
    </div>
  );
}
