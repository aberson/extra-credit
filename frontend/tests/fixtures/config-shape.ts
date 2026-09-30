/**
 * One reading of the composed transport JSON Schema, shared by
 * `schema-parity.test.ts` (every key path it lists must have a parity row)
 * and `config-shape-fingerprint.test.ts` (the lines it prints are the pinned
 * persisted value domain). Both tests therefore list exactly the same paths.
 *
 * A path starts at `$`; `.key` descends into an object property and `[]`
 * into the items of an array.
 */

interface SchemaNode {
  readonly type?: string;
  readonly const?: unknown;
  readonly enum?: readonly unknown[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly pattern?: string;
  readonly uniqueItems?: boolean;
  readonly additionalProperties?: boolean;
  readonly required?: readonly string[];
  readonly allOf?: readonly unknown[];
  readonly properties?: Readonly<Record<string, SchemaNode>>;
  readonly items?: SchemaNode;
}

function nodeLine(path: string, node: SchemaNode): string {
  const parts: string[] = [];
  if (node.type !== undefined) parts.push(`type=${node.type}`);
  if ("const" in node) parts.push(`const=${JSON.stringify(node.const)}`);
  if (node.enum !== undefined) parts.push(`enum=${JSON.stringify(node.enum)}`);
  for (const key of ["minimum", "maximum", "minItems", "maxItems", "pattern"] as const) {
    if (node[key] !== undefined) parts.push(`${key}=${JSON.stringify(node[key])}`);
  }
  if (node.uniqueItems !== undefined) parts.push(`uniqueItems=${String(node.uniqueItems)}`);
  if (node.additionalProperties !== undefined) {
    parts.push(`additionalProperties=${String(node.additionalProperties)}`);
  }
  if (node.required !== undefined) {
    parts.push(`required=${JSON.stringify([...node.required].sort())}`);
  }
  if (node.allOf !== undefined) parts.push(`allOf=${JSON.stringify(node.allOf)}`);
  return `${path} ${parts.join(" ")}`;
}

function visit(node: SchemaNode, path: string, lines: string[]): void {
  lines.push(nodeLine(path, node));
  for (const key of Object.keys(node.properties ?? {}).sort()) {
    visit(node.properties![key]!, `${path}.${key}`, lines);
  }
  if (node.items !== undefined) {
    visit(node.items, `${path}[]`, lines);
  }
}

/** One sorted line per key path: the path, then every constraint it declares. */
export function transportShapeLines(schema: unknown): readonly string[] {
  const lines: string[] = [];
  visit(schema as SchemaNode, "$", lines);
  return lines.sort();
}

/** Every key path the schema declares, sorted. */
export function transportKeyPaths(schema: unknown): readonly string[] {
  return transportShapeLines(schema).map((line) => line.slice(0, line.indexOf(" ")));
}

/** The schema node at a key path, for reading the enum arrays it carries. */
export function transportNodeAt(schema: unknown, path: string): SchemaNode {
  let node = schema as SchemaNode;
  for (const step of path.slice(1).match(/\.[^.[\]]+|\[\]/gu) ?? []) {
    const next = step === "[]" ? node.items : node.properties?.[step.slice(1)];
    if (next === undefined) {
      throw new Error(`The transport schema declares no ${path}.`);
    }
    node = next;
  }
  return node;
}

/**
 * A structured copy of `base` with `value` written at `path` (`[]` means the
 * first element). `undefined` deletes the key.
 */
export function withValueAt(base: unknown, path: string, value: unknown): unknown {
  const copy: unknown = structuredClone(base);
  const steps = path.slice(1).match(/\.[^.[\]]+|\[\]/gu) ?? [];
  if (steps.length === 0) {
    return value;
  }
  let parent = copy as Record<string | number, unknown>;
  steps.slice(0, -1).forEach((step) => {
    parent = parent[step === "[]" ? 0 : step.slice(1)] as Record<string | number, unknown>;
  });
  const last = steps[steps.length - 1]!;
  const key = last === "[]" ? 0 : last.slice(1);
  if (value === undefined) {
    delete parent[key];
  } else {
    parent[key] = value;
  }
  return copy;
}

/** The value at `path` in `base` (`[]` means the first element). */
export function valueAt(base: unknown, path: string): unknown {
  let node = base as Record<string | number, unknown> | undefined;
  for (const step of path.slice(1).match(/\.[^.[\]]+|\[\]/gu) ?? []) {
    node = node?.[step === "[]" ? 0 : step.slice(1)] as Record<string | number, unknown> | undefined;
  }
  return node;
}
