import type { Node } from "../types/index.js";

/**
 * Figma component property values. These come in three shapes:
 *   { type: "TEXT", value: string }
 *   { type: "BOOLEAN", value: boolean }
 *   { type: "INSTANCE_SWAP", value: string }   // node id of replacement component
 *   { type: "VARIANT", value: string }
 *
 * We type loosely because the field is optional / extensible across API versions.
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
 *  1. If the instance already carries `children` (the normal case for v1 file
 *     fetches), reuse them verbatim — Figma has already applied overrides.
 *  2. Otherwise, look up the master COMPONENT by `componentId`, deep-clone its
 *     children with id remapping (so DOM keys stay unique), and graft them on.
 *  3. Walk the (possibly grafted) children and apply `componentProperties` to
 *     each descendant whose `componentPropertyReferences` points at a property
 *     of the instance — this is how modern Figma carries text/visible overrides
 *     for descendants from the instance down to the leaves.
 *
 * The function is pure: it never mutates `instance` or any node in `nodesById`.
 */
export function resolveInstance(
  instance: Node,
  nodesById: Map<string, Node>,
): Node & { children: readonly Node[] } {
  const inst = instance as Node & InstanceLike;
  let children: readonly Node[] = inst.children ?? [];

  if (children.length === 0 && inst.componentId) {
    const master = nodesById.get(inst.componentId) as (Node & { children?: readonly Node[] }) | undefined;
    if (master?.children?.length) {
      children = master.children.map((c, i) => cloneWithRemappedIds(c, `${inst.id};I${i}`));
    }
  }

  if (inst.componentProperties && children.length > 0) {
    children = children.map((c) => applyComponentProperties(c, inst.componentProperties!));
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

/** Recursively apply instance.componentProperties to descendants. */
function applyComponentProperties(
  node: Node,
  props: Record<string, ComponentPropertyValue>,
): Node {
  const n = node as Node & NodeWithRefs;
  let next: Node & NodeWithRefs = n;

  if (n.componentPropertyReferences) {
    let mutated = false;
    const draft: Record<string, unknown> = { ...n };
    for (const [field, refKey] of Object.entries(n.componentPropertyReferences)) {
      // Property keys look like "Label#1234"; the references map points to that exact key.
      const value = props[refKey];
      if (!value) continue;
      const applied = applyOneProperty(field, value, draft);
      if (applied) mutated = true;
    }
    if (mutated) next = draft as Node & NodeWithRefs;
  }

  if (next.children?.length) {
    const newChildren = next.children.map((c) => applyComponentProperties(c, props));
    if (newChildren.some((c, i) => c !== next.children![i])) {
      next = { ...next, children: newChildren } as Node & NodeWithRefs;
    }
  }

  return next as Node;
}

/** Mutates `draft` in place; returns true if it changed anything. */
function applyOneProperty(
  field: string,
  value: ComponentPropertyValue,
  draft: Record<string, unknown>,
): boolean {
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
    // INSTANCE_SWAP / VARIANT require swapping the master itself; that's a
    // larger restructuring. We leave the original descendant in place — the
    // visual will reflect the master's pre-swap shape, which is acceptable
    // for a renderer (vs. crashing or silently dropping content).
    default:
      return false;
  }
}
