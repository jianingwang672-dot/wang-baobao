import test from "node:test";
import assert from "node:assert/strict";
import profile from "../src/data/profile.json";
import { validateData } from "../src/lib/schema";
import {
  applyOperations,
  emptyDraft,
  isPending,
  mergeDrafts,
  parseDraft,
  same,
  stageOperation,
  type Operation,
} from "../src/lib/drafts";
import { publishDraft, PublishConflict } from "../src/lib/github-publish";
const base = () =>
  validateData({
    profile: { ...profile, coverPhotoId: null },
    weights: [],
    feedings: [],
    shedding: [],
    milestones: [],
    photos: [],
  });
const row = {
  id: "TEST-ONLY",
  date: "2026-10-27",
  food: "测试食物",
  quantity: 2,
  unit: "只",
  normal: null,
  supplements: "",
  notes: "仅用于单元测试",
};
test("local create/edit/delete uses real schema and can undo an unpublished addition", () => {
  const b = base();
  const a = stageOperation(b, [], "feedings", row.id, row);
  assert.equal(b.feedings.length, 0);
  assert.equal(applyOperations(b, a).data.feedings[0].quantity, 2);
  const updated = stageOperation(b, a, "feedings", row.id, {
    ...row,
    quantity: 3,
  });
  assert.equal(updated.length, 1);
  assert.equal(updated[0].before, null);
  assert.equal(stageOperation(b, updated, "feedings", row.id, null).length, 0);
});
test("three-way merge keeps unrelated remote records; detects edits to same record", () => {
  const b = base();
  b.feedings = [row];
  const op = stageOperation(b, [], "feedings", row.id, { ...row, quantity: 4 });
  const remote = base();
  remote.feedings = [row, { ...row, id: "other" }];
  assert.equal(applyOperations(remote, op).data.feedings.length, 2);
  remote.feedings[0] = { ...row, quantity: 5 };
  assert.equal(applyOperations(remote, op).conflicts.length, 1);
  assert.equal(applyOperations(remote, op).data.feedings[0].quantity, 5);
});
test("submitted draft stays visible while old bundle loads, then reconciles after deployment", () => {
  const b = base();
  const ops: Operation[] = [
    {
      kind: "feedings",
      id: row.id,
      before: null,
      after: row,
      submitted: { sha: "a".repeat(40), after: row },
    },
  ];
  assert.equal(isPending(ops[0]), false);
  assert.equal(applyOperations(b, ops).data.feedings.length, 1);
  const deployed = base();
  deployed.feedings = [row];
  assert.equal(applyOperations(deployed, ops).remaining.length, 0);
});
test("deleting a newly submitted row before deployment does not cancel the required remote deletion", () => {
  const b = base();
  const ops: Operation[] = [
    {
      kind: "feedings",
      id: row.id,
      before: null,
      after: row,
      submitted: { sha: "a".repeat(40), after: row },
    },
  ];
  const deletion = stageOperation(b, ops, "feedings", row.id, null);
  assert.equal(deletion.length, 1);
  assert.equal(isPending(deletion[0]), true);
  assert.equal(applyOperations(b, deletion).remaining.length, 1);
  const remote = base();
  remote.feedings = [row];
  assert.equal(applyOperations(remote, deletion).data.feedings.length, 0);
});
test("draft restore validates values, IDs and version, and never overwrites conflicting drafts", () => {
  const draft = {
    ...emptyDraft(),
    operations: stageOperation(base(), [], "feedings", row.id, row),
  };
  assert.deepEqual(parseDraft(JSON.parse(JSON.stringify(draft))), draft);
  assert.throws(() => parseDraft({ ...draft, version: 2 }));
  assert.throws(() =>
    parseDraft({
      ...draft,
      operations: [{ ...draft.operations[0], after: { ...row, id: "wrong" } }],
    }),
  );
  assert.throws(() =>
    mergeDrafts(draft, {
      ...draft,
      operations: [{ ...draft.operations[0], after: { ...row, quantity: 9 } }],
    }),
  );
  assert.equal(mergeDrafts(draft, draft).operations.length, 1);
  assert.ok(same({ a: 1, b: 2 }, { b: 2, a: 1 }));
});
function fakeApi(remote = base(), failPatch = false) {
  const calls: { url: string; method: string; body: any }[] = [];
  const request = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input),
      method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, method, body });
    assert.ok(
      url.startsWith(
        "https://api.github.com/repos/jianingwang672-dot/wang-baobao/",
      ),
    );
    assert.ok(!url.includes("test-token"));
    let value: unknown;
    if (url.includes("/contents/src/data/")) {
      const key = url.match(/\/([^/]+)\.json\?/)![1] as keyof typeof remote;
      value = {
        content: Buffer.from(JSON.stringify(remote[key])).toString("base64"),
      };
    } else if (url.endsWith("/git/ref/heads/main"))
      value = { object: { sha: "a".repeat(40) } };
    else if (url.endsWith("/git/commits/" + "a".repeat(40)))
      value = { tree: { sha: "b".repeat(40) } };
    else if (url.endsWith("/git/trees")) value = { sha: "c".repeat(40) };
    else if (url.endsWith("/git/commits")) value = { sha: "d".repeat(40) };
    else if (url.endsWith("/git/refs/heads/main")) {
      if (failPatch) return new Response("{}", { status: 422 });
      value = { object: { sha: "d".repeat(40) } };
    } else throw new Error("Unexpected endpoint " + url);
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return { calls, request };
}
test("publisher commits changed JSON atomically on latest tree, without forced updates", async () => {
  const ops = stageOperation(base(), [], "feedings", row.id, row);
  const { calls, request } = fakeApi();
  const result = await publishDraft("test-token", ops, request);
  assert.equal(result.sha, "d".repeat(40));
  const tree = calls.find(
    (c) => c.method === "POST" && c.url.endsWith("/git/trees"),
  )!.body;
  assert.equal(tree.base_tree, "b".repeat(40));
  assert.deepEqual(
    tree.tree.map((r: any) => r.path),
    ["src/data/feedings.json"],
  );
  assert.equal(JSON.parse(tree.tree[0].content)[0].quantity, 2);
  assert.equal(calls.at(-1)?.body.force, false);
  assert.equal(calls.at(-1)?.method, "PATCH");
  assert.equal(JSON.stringify(ops).includes("test-token"), false);
});
test("publisher rejects conflicting remote data before creating any commits", async () => {
  const b = base();
  b.feedings = [row];
  const ops = stageOperation(b, [], "feedings", row.id, {
    ...row,
    quantity: 3,
  });
  const remote = base();
  remote.feedings = [{ ...row, quantity: 4 }];
  const mock = fakeApi(remote);
  await assert.rejects(
    publishDraft("test-token", ops, mock.request),
    PublishConflict,
  );
  assert.equal(
    mock.calls.some((c) => c.method !== "GET"),
    false,
  );
});
test("retry after a lost response detects data already in GitHub and avoids duplicate commit", async () => {
  const remote = base();
  remote.feedings = [row];
  const mock = fakeApi(remote);
  const r = await publishDraft(
    "test-token",
    stageOperation(base(), [], "feedings", row.id, row),
    mock.request,
  );
  assert.equal(r.alreadySaved, true);
  assert.equal(
    mock.calls.some((c) => c.method !== "GET"),
    false,
  );
});
test("failed authentication/concurrent ref updates preserve operations for recovery", async () => {
  const ops = stageOperation(base(), [], "feedings", row.id, row),
    snapshot = structuredClone(ops);
  await assert.rejects(
    publishDraft(
      "bad",
      ops,
      (async () => new Response("{}", { status: 401 })) as typeof fetch,
    ),
    /令牌/,
  );
  const mock = fakeApi(base(), true);
  await assert.rejects(
    publishDraft("test-token", ops, mock.request),
    /并发修改/,
  );
  assert.deepEqual(ops, snapshot);
});
