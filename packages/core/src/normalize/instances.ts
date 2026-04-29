import type { Node } from "../types/index.js";

/**
 * Figma component property values.
 *   { type: "TEXT", value: string }
 *   { type: "BOOLEAN", value: boolean }
 *   { type: "INSTANCE_SWAP", value: string }   // node id of replacement component
 *   { type: "VARIANT", value: string }
 */
type ComponentPropertyValue =
  | { type: "TEXT"; value: string }
  | { type: "BOOLEAN"; value: boolean }
  | { type: "INSTANCE_SWAP"; value: string }
  | { type: "VARIANT"; value: string }
  | { type: string; value: unknown };

interface InstanceLike {
  id: string;
  type: string;
  componentId?: string;
  children?: readonly Node[];
  componentProperties?: Record<string, ComponentPropertyValue>;
}

interface NodeWithRefs {
  componentPropertyReferences?: Record<string, string>;
  children?: readonly Node[];
  [k: string]: unknown;
}

/**
 * Resolve an INSTANCE node into a renderable subtree.
 *
 *  1. If the instance carries VARIANT properties, switch the master to the
 *     matching sibling COMPONENT inside the parent COMPONENT_SET (forces a
 *     fresh clone of the variant's subtree).
 *  2. If the instance has no `children`, deep-clone the (possibly swapped)
 *     master's children with id remapping.
 *  3. Walk the children and apply `componentProperties`:
 *       - TEXT      -> descendant.characters
 *       - BOOLEAN   -> descendant.visible
 *       - INSTANCE_SWAP on a nested INSTANCE's `mainComponent` ref -> swap
 *         that descendant's componentId and recursively re-resolve from the
 *         new master.
 *       - VARIANT propagates only at the top level (handled in step 1).
 *
 * Pure: never mutates `instance` or any node in `nodesById`.
 *
 * `parentOf` is optional; without it VARIANT switching is skipped (callers
 * that don't care about variants can still use the legacy two-arg call).
 */
export function resolveInstance(
  instance: Node,
  nodesById: Map<string, Node>,
  parentOf?: Map<string, string | null>,
): Node & { children: readonly Node[] } {
  const inst = instance as Node & InstanceLike;

  // Step 1: VARIANT -> pick a sibling COMPONENT inside the parent COMPONENT_SET.
  let masterId = inst.componentId;
  if (masterId && parentOf && inst.componentProperties) {
    const swapped = pickVariantMaster(masterId, inst.componentProperties, nodesById, parentOf);
    if (swapped) masterId = swapped;
  }
  const variantSwapped = masterId !== inst.componentId;

  let children: readonly Node[] = inst.children ?? [];

  if ((children.length === 0 || variantSwapped) && masterId) {
    const master = nodesById.get(masterId) as (Node & { children?: readonly Node[] }) | undefined;
    if (master?.children?.length) {
      children = master.children.map((c, i) => cloneWithRemappedIds(c, `${inst.id};I${i}`));
    }
  }

  if (inst.componentProperties && children.length > 0) {
    children = children.map((c) =>
      applyComponentProperties(c, inst.componentProperties!, nodesById, parentOf),
    );
  }

  return { ...(inst as Node), children } as Node & { children: readonly Node[] };
}

/** Deep-clone a node subtree, prefixing every descendant id with `idPrefix`. */
function cloneWithRemappedIds(node: Node, idPrefix: string): Node {
  const cloned: Node = { ...node, id: idPrefix };
  const withChildren = node as Node & { children?: readonly Node[] };
  if (withChildren.children?.length) {
    (cloned as Node & { children: Node[] }).children = withChildren.children.map((c, i) =>
      cloneWithRemappedIds(c, `${idPrefix};${i}`),
    );
  }
  return cloned;
}

/**
 * If the instance has any VARIANT properties, find the sibling COMPONENT in the
 * parent COMPONENT_SET whose name matches the requested assignments. Returns
 * the matching component's id, or null if there are no VARIANT properties or
 * no sibling matched.
 */
function pickVariantMaster(
  masterId: string,
  props: Record<string, ComponentPropertyValue>,
  nodesById: Map<string, Node>,
  parentOf: Map<string, string | null>,
): string | null {
  // Collect bare-name -> requested-value, e.g. { State: "Hover", Size: "Large" }.
  const wanted: Record<string, string> = {};
  let hasAny = false;
  for (const [rawKey, val] of Object.entries(props)) {
    if (val.type !== "VARIANT" || typeof val.value !== "string") continue;
    // Property keys may be suffixed with "#1:0"; the variant name uses the bare prefix.
    const hashAt = rawKey.indexOf("#");
    const bare = hashAt === -1 ? rawKey : rawKey.slice(0, hashAt);
    wanted[bare] = val.value;
    hasAny = true;
  }
  if (!hasAny) return null;

  const setId = parentOf.get(masterId);
  if (!setId) return null;
  const set = nodesById.get(setId) as (Node & { children?: readonly Node[] }) | undefined;
  if (!set || (set as Node).type !== "COMPONENT_SET" || !set.children?.length) return null;

  for (const sibling of set.children) {
    const sib = sibling as Node & { name?: string };
    if (sib.type !== "COMPONENT") continue;
    const parsed = parseVariantName(sib.name ?? "");
    let allMatch = true;
    for (const [k, v] of Object.entries(wanted)) {
      if (parsed[k] !== v) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return sib.id;
  }
  return null;
}

/** Parse a variant component name like `"State=Hover, Size=Large"`. */
function parseVariantName(name: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of name.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

/** Recursively apply instance.componentProperties to descendants. */
function applyComponentProperties(
  node: Node,
  props: Record<string, ComponentPropertyValue>,
  nodesById: Map<string, Node>,
  parentOf: Map<string, string | null> | undefined,
): Node {
  const n = node as Node & NodeWithRefs & InstanceLike;
  let next: Node & NodeWithRefs & InstanceLike = n;
  let swappedMaster = false;

  if (n.componentPropertyReferences) {
    let mutated = false;
    const draft: Record<string, unknown> = { ...n };
    for (const [field, refKey] of Object.entries(n.componentPropertyReferences)) {
      const value = props[refKey];
      if (!value) continue;
      const result = applyOneProperty(field, value, draft);
      if (result === "swapped") {
        mutated = true;
        swappedMaster = true;
      } else if (result) {
        mutated = true;
      }
    }
    if (mutated) next = draft as Node & NodeWithRefs & InstanceLike;
  }

  // INSTANCE_SWAP: if this descendant is an INSTANCE whose mainComponent was
  // just rebound, drop inherited children and re-resolve from the new master.
  if (swappedMaster && next.type === "INSTANCE") {
    const reset = { ...next, children: [] as readonly Node[] } as Node & InstanceLike;
    return resolveInstance(reset as Node, nodesById, parentOf);
  }

  if (next.children?.length) {
    const newChildren = next.children.map((c) =>
      applyComponentProperties(c, props, nodesById, parentOf),
    );
    if (newChildren.some((c, i) => c !== next.children![i])) {
      next = { ...next, children: newChildren } as Node & NodeWithRefs & InstanceLike;
    }
  }

  return next as Node;
}

/**
 * Apply one componentProperty to `draft`. Returns:
 *   - false    : unchanged
 *   - true     : mutated (TEXT/BOOLEAN-style override)
 *   - "swapped": mutated AND the node's master was rebound (INSTANCE_SWAP)
 */
function applyOneProperty(
  field: string,
  value: ComponentPropertyValue,
  draft: Record<string, unknown>,
): boolean | "swapped" {
  switch (field) {
    case "characters":
      if (value.type === "TEXT" && typeof value.value === "string") {
        draft.characters = value.value;
        return true;
      }
      return false;
    case "visible":
      if (value.type === "BOOLEAN" && typeof value.value === "boolean") {
        draft.visible = value.value;
        return true;
      }
      return false;
    case "mainComponent":
      // INSTANCE_SWAP: descendant INSTANCE's master is replaced. Caller will
      // drop inherited children and re-resolve via the new master.
      if (value.type === "INSTANCE_SWAP" && typeof value.value === "string") {
        draft.componentId = value.value;
        draft.children = [];
        return "swapped";
      }
      return false;
    default:
      return false;
  }
}
