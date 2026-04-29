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

// Fixture exercising VARIANT (COMPONENT_SET → child COMPONENT) + nested INSTANCE_SWAP.
const fileWithVariantsAndSwap = JSON.stringify({
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
          // An icon library: two alternative icon components for INSTANCE_SWAP.
          {
            id: "ICON:A",
            name: "IconA",
            type: "COMPONENT",
            children: [{ id: "ICON:A:1", name: "glyphA", type: "TEXT", characters: "A" }],
          },
          {
            id: "ICON:B",
            name: "IconB",
            type: "COMPONENT",
            children: [{ id: "ICON:B:1", name: "glyphB", type: "TEXT", characters: "B" }],
          },
          // A COMPONENT_SET (Button) with two variants: State=Default, State=Hover.
          {
            id: "BTN:SET",
            name: "Button",
            type: "COMPONENT_SET",
            children: [
              {
                id: "BTN:DEFAULT",
                name: "State=Default",
                type: "COMPONENT",
                children: [
                  {
                    id: "BTN:DEFAULT:LBL",
                    name: "Label",
                    type: "TEXT",
                    characters: "Default",
                  },
                  // Nested instance whose mainComponent is overridable via INSTANCE_SWAP.
                  {
                    id: "BTN:DEFAULT:ICON",
                    name: "Icon",
                    type: "INSTANCE",
                    componentId: "ICON:A",
                    componentPropertyReferences: { mainComponent: "Glyph#9:0" },
                  },
                ],
              },
              {
                id: "BTN:HOVER",
                name: "State=Hover",
                type: "COMPONENT",
                children: [
                  {
                    id: "BTN:HOVER:LBL",
                    name: "Label",
                    type: "TEXT",
                    characters: "Hover",
                  },
                  {
                    id: "BTN:HOVER:ICON",
                    name: "Icon",
                    type: "INSTANCE",
                    componentId: "ICON:A",
                    componentPropertyReferences: { mainComponent: "Glyph#9:0" },
                  },
                ],
              },
            ],
          },
          // Instance pointing at the Default variant; asks for Hover via VARIANT
          // and swaps the icon to ICON:B via INSTANCE_SWAP.
          {
            id: "USE:1",
            name: "Btn use",
            type: "INSTANCE",
            componentId: "BTN:DEFAULT",
            componentProperties: {
              State: { type: "VARIANT", value: "Hover" },
              "Glyph#9:0": { type: "INSTANCE_SWAP", value: "ICON:B" },
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

describe("resolveInstance + VARIANT + INSTANCE_SWAP", () => {
  it("VARIANT switches the master to the matching sibling COMPONENT", () => {
    const file = parseFigmaJson(fileWithVariantsAndSwap);
    const idx = indexDocument(file);
    const inst = getInstance(idx, "USE:1");
    const resolved = resolveInstance(inst, idx.byId, idx.parentOf);
    expect(resolved.children).toHaveLength(2);
    const label = resolved.children[0] as Node & { characters?: string };
    // Confirms we cloned from BTN:HOVER (variant), not BTN:DEFAULT.
    expect(label.characters).toBe("Hover");
  });

  it("INSTANCE_SWAP rebinds a nested INSTANCE descendant to a new master", () => {
    const file = parseFigmaJson(fileWithVariantsAndSwap);
    const idx = indexDocument(file);
    const inst = getInstance(idx, "USE:1");
    const resolved = resolveInstance(inst, idx.byId, idx.parentOf);
    // Second child is the nested icon INSTANCE, now backed by ICON:B.
    const icon = resolved.children[1] as Node & {
      componentId?: string;
      children?: readonly Node[];
    };
    expect(icon.componentId).toBe("ICON:B");
    // Re-resolved subtree should mirror ICON:B's child glyph.
    expect(icon.children).toHaveLength(1);
    const glyph = icon.children![0] as Node & { characters?: string };
    expect(glyph.characters).toBe("B");
  });

  it("missing parentOf still works (legacy two-arg call) but skips VARIANT", () => {
    const file = parseFigmaJson(fileWithVariantsAndSwap);
    const idx = indexDocument(file);
    const inst = getInstance(idx, "USE:1");
    const resolved = resolveInstance(inst, idx.byId);
    const label = resolved.children[0] as Node & { characters?: string };
    // Without parentOf, VARIANT cannot swap masters, so we fall back to BTN:DEFAULT.
    expect(label.characters).toBe("Default");
  });

  it("does not mutate either variant master", () => {
    const file = parseFigmaJson(fileWithVariantsAndSwap);
    const idx = indexDocument(file);
    resolveInstance(getInstance(idx, "USE:1"), idx.byId, idx.parentOf);
    const hoverMaster = idx.byId.get("BTN:HOVER") as Node & { children: readonly Node[] };
    const hoverIcon = hoverMaster.children[1] as Node & { componentId?: string };
    expect(hoverIcon.componentId).toBe("ICON:A");
  });
});
