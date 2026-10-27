import { z } from "zod";
import {
  profileSchema,
  recordSchemas,
  validateData,
  type DiaryData,
} from "./schema";
export const editableKinds = [
  "feedings",
  "weights",
  "shedding",
  "milestones",
  "profile",
] as const;
export type EditableKind = (typeof editableKinds)[number];
export const kindNames: Record<EditableKind, string> = {
  feedings: "喂食记录",
  weights: "体重记录",
  shedding: "蜕皮与健康",
  milestones: "成长事件",
  profile: "豹豹档案",
};
export type Entry =
  | DiaryData["feedings"][number]
  | DiaryData["weights"][number]
  | DiaryData["shedding"][number]
  | DiaryData["milestones"][number]
  | DiaryData["profile"];
export type Operation = {
  kind: EditableKind;
  id: string;
  before: Entry | null;
  after: Entry | null;
  submitted?: { sha: string; after: Entry | null };
};
export type Draft = { version: 1; savedAt: string; operations: Operation[] };
export const draftKey = "baobao.diary.draft.v1";
export const emptyDraft = (): Draft => ({
  version: 1,
  savedAt: new Date().toISOString(),
  operations: [],
});
export function same(a: unknown, b: unknown): boolean {
  const canonical = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, x]) => [k, canonical(x)]),
          )
        : v;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
export function entryAt(
  data: DiaryData,
  kind: EditableKind,
  id: string,
): Entry | null {
  return kind === "profile"
    ? data.profile
    : (data[kind].find((r) => r.id === id) ?? null);
}
export function validateEntry(kind: EditableKind, input: unknown): Entry {
  return kind === "profile"
    ? profileSchema.parse(input)
    : recordSchemas[kind].parse(input);
}
export function parseDraft(input: unknown): Draft {
  const raw = z
    .object({
      version: z.literal(1),
      savedAt: z.iso.datetime(),
      operations: z.array(
        z
          .object({
            kind: z.enum(editableKinds),
            id: z.string().min(1),
            before: z.unknown(),
            after: z.unknown(),
            submitted: z
              .object({
                sha: z.string().regex(/^[a-f0-9]{40}$/),
                after: z.unknown(),
              })
              .strict()
              .optional(),
          })
          .strict(),
      ),
    })
    .strict()
    .parse(input);
  const seen = new Set<string>();
  const operations = raw.operations.map((o) => {
    const key = `${o.kind}:${o.id}`;
    if (seen.has(key)) throw new Error("草稿包含重复记录");
    seen.add(key);
    const parse = (v: unknown) => {
      if (v === null) {
        if (o.kind === "profile") throw new Error("档案不能删除");
        return null;
      }
      const row = validateEntry(o.kind, v);
      if (
        o.kind === "profile"
          ? o.id !== "profile"
          : !("id" in row) || row.id !== o.id
      )
        throw new Error("草稿记录 ID 不匹配");
      return row;
    };
    return {
      kind: o.kind,
      id: o.id,
      before: parse(o.before),
      after: parse(o.after),
      ...(o.submitted
        ? {
            submitted: {
              sha: o.submitted.sha,
              after: parse(o.submitted.after),
            },
          }
        : {}),
    };
  });
  return { version: 1, savedAt: raw.savedAt, operations };
}
export function isPending(op: Operation) {
  return !op.submitted || !same(op.submitted.after, op.after);
}
export function applyOperations(base: DiaryData, operations: Operation[]) {
  const data = structuredClone(base);
  const conflicts: Operation[] = [];
  const remaining: Operation[] = [];
  for (const op of operations) {
    const current = entryAt(base, op.kind, op.id);
    // A submitted intermediate value can outlive the old Pages bundle until deployment finishes.
    if (
      same(current, op.after) &&
      (!op.submitted || same(op.submitted.after, op.after))
    )
      continue;
    remaining.push(op);
    if (
      !same(current, op.before) &&
      !(op.submitted && same(current, op.submitted.after))
    ) {
      conflicts.push(op);
      continue;
    }
    if (op.kind === "profile") data.profile = profileSchema.parse(op.after);
    else {
      const rows = data[op.kind] as Exclude<Entry, DiaryData["profile"]>[];
      const index = rows.findIndex((r) => r.id === op.id);
      if (op.after === null) {
        if (index >= 0) rows.splice(index, 1);
      } else if (index >= 0) rows[index] = op.after as (typeof rows)[number];
      else rows.push(op.after as (typeof rows)[number]);
    }
  }
  return { data: validateData(data), conflicts, remaining };
}
export function stageOperation(
  base: DiaryData,
  operations: Operation[],
  kind: EditableKind,
  id: string,
  after: Entry | null,
) {
  const previous = operations.find((o) => o.kind === kind && o.id === id);
  const before = previous?.before ?? entryAt(base, kind, id);
  const rest = operations.filter((o) => o !== previous);
  if (!previous?.submitted && same(before, after)) return rest;
  return [
    ...rest,
    {
      kind,
      id,
      before,
      after,
      ...(previous?.submitted ? { submitted: previous.submitted } : {}),
    },
  ];
}
export function mergeDrafts(current: Draft, incoming: Draft): Draft {
  const operations = [...current.operations];
  for (const op of incoming.operations) {
    const existing = operations.find(
      (o) => o.kind === op.kind && o.id === op.id,
    );
    if (existing && !same(existing, op))
      throw new Error(
        `${kindNames[op.kind]} ${op.id} 与本机草稿不同，未覆盖。请先导出当前草稿再处理。`,
      );
    if (!existing) operations.push(op);
  }
  return { version: 1, savedAt: new Date().toISOString(), operations };
}
