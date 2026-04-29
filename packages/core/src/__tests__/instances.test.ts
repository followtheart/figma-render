import { describe, it, expect } from "vitest";
import { resolveInstance } from "../normalize/instances.js";
import { indexDocument } from "../normalize/tree.js";
import { parseFigmaJson } from "../fetcher/parse.js";
import type { Node } from "../types/index.js";

const fileWithComponent = JSON.stringify({
  name: "Demo",
  lastModified: "",
  version: "1",
  document: {
    id: "0:0",
    name: "Document",
    type: "DOCUMENT",
    children: [
      {
        id: "0:1",
        name: "Page 1",
        type: "CANVAS",
        children: [
          // The master component lives here.
          {
            id: "100:1",
            name: "Button",
            type: "COMPONENT",
            children: [
              {
                id: "100:2",
                name: "Label",
                type: "TEXT",
                characters: "Default",
                componentPropertyReferences: { characters: "Label#1:0" },
              },
              {
                id: "100:3",
                name: "Icon",
                type: "VECTOR",
                componentPropertyReferences: { visible: "ShowIcon#1:1" },
              },
            ],
          },
          // An instance with children already expanded (the normal API case).
          {
            id: "200:1",
            name: "Btn (resolved)",
            type: "INSTANCE",
            componentId: "100:1",
            children: [
              {
                id: "200:2",
                name: "Label",
                type: "TEXT",
                characters: "Click me",
                componentPropertyReferences: { characters: "Label#1:0" },
              },
            ],
            componentProperties: {
              "Label#1:0": { type: "TEXT", value: "Submit" },
              "ShowIcon#1:1": { type: "BOOLEAN", value: false },
            },
          },
          // An instance WITHOUT children — exercises the master-cloning path.
          {
            id: "300:1",
            name: "Btn (pruned)",
            type: "INSTANCE",
            componentId: "100:1",
            componentProperties: {
              "Label#1:0": { type: "TEXT", value: "Cancel" },
              "ShowIcon#1:1": { type: "BOOLEAN", value: false },
            },
          },
        ],
      },
    ],
  },
  components: {},
  componentSets: {},
  styles: {},
});

function getInstance(idx: ReturnType<typeof indexDocument>, id: string): Node {
  const n = idx.byId.get(id);
  if (!n) throw new Error(`missing ${id}`);
  return n;
}

describe("resolveInstance", () => {
  it("applies componentProperties to descendants when children already exist", () => {
    const file = parseFigmaJson(fileWithComponent);
    const idx = indexDocument(file);
    const inst = getInstance(idx, "200:1");
    const resolved = resolveInstance(inst, idx.byId);
    expect(resolved.children).toHaveLength(1);
    const label = resolved.children[0] as Node & { characters?: string };
    expect(label.characters).toBe("Submit");
  });

  it("clones master children when the instance has none", () => {
    const file = parseFigmaJson(fileWithComponent);
    const idx = indexDocument(file);
    const inst = getInstance(idx, "300:1");
    const resolved = resolveInstance(inst, idx.byId);
    expect(resolved.children).toHaveLength(2);

    const label = resolved.children[0] as Node & { characters?: string };
    expect(label.characters).toBe("Cancel"); // overridden via componentProperties
    expect(label.id).toMatch(/^300:1;I0/); // remapped to instance scope

    const icon = resolved.children[1] as Node & { visible?: boolean };
    expect(icon.visible).toBe(false); // overridden via BOOLEAN property
  });

  it("does not mutate the master component", () => {
    const file = parseFigmaJson(fileWithComponent);
    const idx = indexDocument(file);
    const master = idx.byId.get("100:1") as Node & { children: readonly Node[] };
    const masterLabelBefore = master.children[0] as Node & { characters?: string };
    expect(masterLabelBefore.characters).toBe("Default");

    resolveInstance(getInstance(idx, "300:1"), idx.byId);

    const masterLabelAfter = master.children[0] as Node & { characters?: string };
    expect(masterLabelAfter.characters).toBe("Default");
  });

  it("returns instance unchanged when componentId is unknown", () => {
    const file = parseFigmaJson(fileWithComponent);
    const idx = indexDocument(file);
    const orphan: Node = {
      id: "999:1",
      name: "Orphan",
      type: "INSTANCE",
      componentId: "does-not-exist",
    } as never;
    const resolved = resolveInstance(orphan, idx.byId);
    expect(resolved.children).toEqual([]);
  });
});
