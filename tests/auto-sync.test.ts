import test from "node:test";
import assert from "node:assert/strict";
import profile from "../src/data/profile.json";
import {
  AutoSyncQueue,
  retryDelay,
  type SyncStatus,
} from "../src/lib/auto-sync";
import {
  clearConnection,
  deviceConnectionKey,
  sessionConnectionKey,
  readConnection,
  storeConnection,
} from "../src/lib/connection";
import {
  GitHubError,
  PublishConflict,
  verifyConnection,
  readLatestDiary,
  type PublishResult,
} from "../src/lib/github-publish";
import { same, type Operation } from "../src/lib/drafts";
import { validateData } from "../src/lib/schema";
const fixture = () =>
  validateData({
    profile: { ...profile, coverPhotoId: null },
    feedings: [],
    weights: [],
    shedding: [],
    milestones: [],
    photos: [],
  });
const operation = (n = 1): Operation => ({
  kind: "weights",
  id: "TEST-ONLY",
  before: null,
  after: { id: "TEST-ONLY", date: "2026-10-27", grams: n, notes: "仅测试" },
});
const result = (): PublishResult => ({
  sha: "a".repeat(40),
  url: "https://github.com/test/commit/test",
  alreadySaved: false,
  data: fixture(),
});
const settled = () => new Promise<void>((resolve) => setImmediate(resolve));
function harness(
  publish: (
    ops: Operation[],
    signal: AbortSignal,
  ) => Promise<PublishResult> = async () => result(),
) {
  let operations: Operation[] = [];
  let online = true;
  let count = 0;
  const timers = new Map<number, { fn: () => void; ms: number }>();
  const statuses: SyncStatus[] = [];
  const calls: Operation[][] = [];
  const accepted: Operation[][] = [];
  const queue = new AutoSyncQueue({
    getOperations: () => operations,
    publish: async (ops, signal) => {
      calls.push(structuredClone(ops));
      return publish(ops, signal);
    },
    accept: (_r, sent) => {
      accepted.push(sent);
      operations = operations.filter(
        (op) => !sent.some((s) => s.id === op.id && same(s.after, op.after)),
      );
    },
    onStatus: (s) => statuses.push(s),
    onConflict: () => {},
    online: () => online,
    schedule: (fn, ms) => {
      timers.set(++count, { fn, ms });
      return count as unknown as ReturnType<typeof setTimeout>;
    },
    cancel: (id) => {
      timers.delete(id as unknown as number);
    },
  });
  return {
    queue,
    statuses,
    calls,
    accepted,
    timers,
    set: (ops: Operation[]) => {
      operations = ops;
    },
    pending: () => operations,
    online: (v: boolean) => {
      online = v;
    },
    tick: async () => {
      const entry = timers.entries().next().value;
      if (entry) {
        timers.delete(entry[0]);
        entry[1].fn();
        await settled();
      }
    },
  };
}
test("connected saves automatically submit after debounce, with no manual publish action", async () => {
  const h = harness();
  h.queue.activate();
  h.set([operation()]);
  h.queue.notify();
  assert.equal(h.calls.length, 0);
  await h.tick();
  assert.equal(h.calls.length, 1);
  assert.equal(h.pending().length, 0);
  assert.equal(h.statuses.at(-1)?.phase, "synced");
});
test("rapid saves coalesce and a save made during a request is sent next", async () => {
  let finish!: (r: PublishResult) => void;
  let first = true;
  const h = harness(async () => {
    if (first) {
      first = false;
      return new Promise((r) => {
        finish = r;
      });
    }
    return result();
  });
  h.queue.activate();
  h.set([operation(1)]);
  h.queue.notify();
  h.set([operation(2)]);
  h.queue.notify();
  assert.equal(h.timers.size, 1);
  await h.tick();
  assert.equal(
    h.calls[0][0].after && "grams" in h.calls[0][0].after
      ? h.calls[0][0].after.grams
      : null,
    2,
  );
  h.set([operation(3)]);
  h.queue.notify();
  finish(result());
  await settled();
  await h.tick();
  assert.equal(h.calls.length, 2);
  assert.equal(h.pending().length, 0);
});
test("transient failures retain records and retry with bounded backoff", async () => {
  let fail = true;
  const h = harness(async () => {
    if (fail) {
      fail = false;
      throw new GitHubError("offline", 0, true);
    }
    return result();
  });
  h.set([operation()]);
  h.queue.activate();
  await h.tick();
  assert.equal(h.pending().length, 1);
  assert.equal([...h.timers.values()][0].ms, 5000);
  await h.tick();
  assert.equal(h.calls.length, 2);
  assert.equal(h.pending().length, 0);
  assert.equal(retryDelay(50), 60000);
});
test("offline saves wait for connectivity; authentication errors stop automatic retry", async () => {
  const h = harness();
  h.online(false);
  h.set([operation()]);
  h.queue.activate();
  assert.equal(h.calls.length, 0);
  assert.equal(h.statuses.at(-1)?.phase, "offline");
  h.online(true);
  h.queue.notify(0);
  await h.tick();
  assert.equal(h.calls.length, 1);
  const denied = harness(async () => {
    throw new GitHubError("expired", 401, false);
  });
  denied.set([operation()]);
  denied.queue.activate();
  await denied.tick();
  assert.equal(denied.pending().length, 1);
  assert.equal(denied.timers.size, 0);
  denied.queue.notify();
  assert.equal(denied.timers.size, 0);
  assert.equal(denied.statuses.at(-1)?.phase, "error");
});
test("conflicting records pause for explicit resolution and disconnect cancels queued writes", async () => {
  const h = harness(async () => {
    throw new PublishConflict(fixture(), [operation()]);
  });
  h.set([operation()]);
  h.queue.activate();
  await h.tick();
  assert.equal(h.statuses.at(-1)?.phase, "conflict");
  assert.equal(h.timers.size, 0);
  const next = harness();
  next.set([operation()]);
  next.queue.activate();
  next.queue.pause();
  await next.tick();
  assert.equal(next.calls.length, 0);
  assert.equal(next.pending().length, 1);
});
test("disconnect aborts an active request and never clears unsynced records", async () => {
  let active!: AbortSignal;
  const h = harness(async (_ops, signal) => {
    active = signal;
    return new Promise((_resolve, reject) =>
      signal.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")),
      ),
    );
  });
  h.set([operation()]);
  h.queue.activate();
  await h.tick();
  h.queue.pause();
  await settled();
  assert.equal(active.aborted, true);
  assert.equal(h.pending().length, 1);
  assert.equal(h.accepted.length, 0);
  assert.equal(h.timers.size, 0);
});
class MemoryStore {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}
test("credentials use session storage by default; remembering a device is explicit and disconnect clears both", () => {
  const device = new MemoryStore(),
    session = new MemoryStore();
  storeConnection({ token: "TEST-TOKEN", remember: false }, device, session);
  assert.equal(device.getItem(deviceConnectionKey), null);
  assert.ok(session.getItem(sessionConnectionKey));
  assert.equal(readConnection(device, session)?.remember, false);
  storeConnection({ token: "TEST-TOKEN", remember: true }, device, session);
  assert.equal(session.getItem(sessionConnectionKey), null);
  assert.equal(readConnection(device, session)?.remember, true);
  clearConnection(device, session);
  assert.equal(readConnection(device, session), null);
  device.setItem(deviceConnectionKey, "damaged");
  assert.equal(readConnection(device, session), null);
});
test("connection verification checks write access without editing any branch or records", async () => {
  const calls: any[] = [];
  await verifyConnection("TEST-TOKEN", (async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: JSON.parse(String(init?.body)),
    });
    return new Response(JSON.stringify({ sha: "a".repeat(40) }), {
      status: 201,
    });
  }) as typeof fetch);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith("/git/blobs"));
  assert.deepEqual(calls[0].body, { content: "", encoding: "utf-8" });
  assert.ok(!calls[0].url.includes("TEST-TOKEN"));
});
test("public refresh reads all collections at one immutable SHA and sends no anonymous Authorization header", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const data = fixture(),
    sha = "c".repeat(40);
  const fetcher = (async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith("https://api.github.com/")) {
      assert.equal("Authorization" in (init?.headers ?? {}), false);
      return new Response(JSON.stringify({ object: { sha } }));
    }
    assert.ok(url.includes(`/${sha}/src/data/`));
    const key = url
      .split("/")
      .at(-1)!
      .replace(".json", "") as keyof typeof data;
    assert.equal(init?.headers, undefined);
    return new Response(JSON.stringify(data[key]));
  }) as typeof fetch;
  const refreshed = await readLatestDiary(undefined, "", fetcher);
  assert.deepEqual(refreshed.data, data);
  assert.equal(calls.length, 7);
  calls.length = 0;
  const unchanged = await readLatestDiary(sha, "", fetcher);
  assert.equal(unchanged.data, null);
  assert.equal(calls.length, 1);
});
