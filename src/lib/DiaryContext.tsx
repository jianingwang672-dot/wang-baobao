import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { data as publishedData } from "./data";
import {
  applyOperations,
  draftKey,
  emptyDraft,
  entryAt,
  isPending,
  mergeDrafts,
  parseDraft,
  same,
  stageOperation,
  validateEntry,
  type Draft,
  type EditableKind,
  type Entry,
  type Operation,
} from "./drafts";
import type { DiaryData } from "./schema";
import { AutoSyncQueue, type SyncStatus } from "./auto-sync";
import {
  clearConnection,
  deviceConnectionKey,
  readConnection,
  storeConnection,
  type Connection,
} from "./connection";
import {
  GitHubError,
  publishDraft,
  readLatestDiary,
  verifyConnection,
  type PublishConflict,
} from "./github-publish";
type Editor = { kind: EditableKind; id?: string };
function initialState() {
  try {
    const raw = localStorage.getItem(draftKey);
    return {
      raw,
      draft: raw ? parseDraft(JSON.parse(raw)) : emptyDraft(),
      error: "",
    };
  } catch {
    return {
      raw: null,
      draft: emptyDraft(),
      error: "本机草稿无法读取。请先导出已有草稿原文，不要清理浏览器数据。",
    };
  }
}
type DiaryContextValue = ReturnType<typeof useDiaryState>;
const DiaryContext = createContext<DiaryContextValue | null>(null);
function useDiaryState() {
  const [initial] = useState(initialState);
  const [base, setBase] = useState(publishedData);
  const [draft, setDraft] = useState(initial.draft);
  const [error, setError] = useState(initial.error);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [toast, setToast] = useState("");
  const [connection, setConnection] = useState<Connection | null>(() => {
    try {
      return readConnection(localStorage, sessionStorage);
    } catch {
      return null;
    }
  });
  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  const [connecting, setConnecting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    phase: "idle",
    message: "连接 GitHub 后，保存的记录会自动同步。",
  });
  const [remoteConflict, setRemoteConflict] = useState<{
    data: DiaryData;
    ops: Operation[];
  } | null>(null);
  const remoteShaRef = useRef<string | undefined>(undefined);
  const readVersion = useRef(0);
  const connectVersion = useRef(0);
  const rawRef = useRef(initial.raw);
  const applied = applyOperations(base, draft.operations);
  const pending = applied.remaining.filter(isPending);
  const current = useRef({ base, error });
  current.current = { base, error };
  const queueRef = useRef<AutoSyncQueue | null>(null);
  if (!queueRef.current)
    queueRef.current = new AutoSyncQueue({
      getOperations: () => {
        if (current.current.error) return [];
        try {
          const raw = localStorage.getItem(draftKey);
          const latest = raw ? parseDraft(JSON.parse(raw)) : emptyDraft();
          return applyOperations(
            current.current.base,
            latest.operations,
          ).remaining.filter(isPending);
        } catch {
          setError("本机草稿无法读取，请先在同步与备份中导出草稿原文。");
          return [];
        }
      },
      publish: async (operations, signal) => {
        const active = connectionRef.current;
        if (!active) throw new GitHubError("请先连接 GitHub。", 401, false);
        readVersion.current++;
        const run = () => publishDraft(active.token, operations, fetch, signal);
        return navigator.locks
          ? navigator.locks.request("baobao-github-auto-sync", { signal }, run)
          : run();
      },
      accept: (result, sent) => {
        acknowledge(result.sha, sent);
        readVersion.current++;
        remoteShaRef.current = result.sha;
        setBase(result.data);
        setRemoteConflict(null);
      },
      onStatus: setSyncStatus,
      onConflict: (failure: PublishConflict) =>
        setRemoteConflict({ data: failure.remote, ops: failure.operations }),
      online: () => navigator.onLine !== false,
    });
  const pendingSignature = JSON.stringify(pending);
  useEffect(() => {
    if (connection) queueRef.current!.activate();
    else queueRef.current!.pause();
    return () => queueRef.current!.pause();
  }, [connection]);
  useEffect(() => {
    queueRef.current!.notify();
  }, [pendingSignature]);
  async function refreshLatest() {
    const version = ++readVersion.current;
    try {
      const latest = await readLatestDiary(
        remoteShaRef.current,
        connectionRef.current?.token ?? "",
      );
      if (version !== readVersion.current) return;
      if (latest.data) setBase(latest.data);
      remoteShaRef.current = latest.sha;
    } catch {
      /* A failed public refresh keeps the last validated repository data and local drafts. */
    }
  }
  useEffect(() => {
    void refreshLatest();
    const update = () => {
      if (document.visibilityState === "visible") void refreshLatest();
    };
    const online = () => {
      queueRef.current!.notify(0);
      update();
    };
    const timer = setInterval(update, 120000);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", update);
    return () => {
      readVersion.current++;
      clearInterval(timer);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  async function connect(token: string, remember: boolean) {
    const version = ++connectVersion.current;
    setConnecting(true);
    try {
      await verifyConnection(token);
      if (version !== connectVersion.current) return;
      const value = { token: token.trim(), remember };
      storeConnection(value, localStorage, sessionStorage);
      setConnection(value);
      setRemoteConflict(null);
      setToast("GitHub 已连接，保存后会自动同步。");
    } finally {
      if (version === connectVersion.current) setConnecting(false);
    }
  }
  function disconnect() {
    connectVersion.current++;
    setConnecting(false);
    queueRef.current!.pause();
    try {
      clearConnection(localStorage, sessionStorage);
    } finally {
      setConnection(null);
      connectionRef.current = null;
    }
    setToast("已断开 GitHub；未同步记录仍在本机保留。");
  }
  function retrySync() {
    setRemoteConflict(null);
    queueRef.current!.retry();
  }
  function persist(next: Draft) {
    const raw = JSON.stringify(next);
    try {
      if (localStorage.getItem(draftKey) !== rawRef.current)
        throw new Error("另一标签页修改了草稿，请重新打开表单后再保存。");
      localStorage.setItem(draftKey, raw);
    } catch (e) {
      throw new Error(
        e instanceof Error && e.message.includes("另一标签页")
          ? e.message
          : "浏览器无法保存草稿，可能空间不足或已禁用存储。本次没有保存成功。",
      );
    }
    rawRef.current = raw;
    setDraft(next);
    setError("");
  }
  useEffect(() => {
    function changed(e: StorageEvent) {
      if (e.key === deviceConnectionKey) {
        setConnection(readConnection(localStorage, sessionStorage));
        return;
      }
      if (e.key !== draftKey) return;
      try {
        const next = e.newValue
          ? parseDraft(JSON.parse(e.newValue))
          : emptyDraft();
        rawRef.current = e.newValue;
        setDraft(next);
        setToast("已同步另一标签页的本机草稿；打开的表单请重新核对。");
      } catch {
        setError("另一标签页写入了无法读取的草稿，请先备份。");
      }
    }
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 7000);
    return () => clearTimeout(t);
  }, [toast]);
  function save(
    kind: EditableKind,
    id: string,
    input: unknown,
    expected: Entry | null,
  ) {
    const after = validateEntry(kind, input);
    if (!same(entryAt(applied.data, kind, id), expected))
      throw new Error("这条记录已在其他标签页修改，请关闭后重新打开。");
    persist({
      version: 1,
      savedAt: new Date().toISOString(),
      operations: stageOperation(base, applied.remaining, kind, id, after),
    });
    setToast(
      connectionRef.current
        ? "已保存，正在自动同步到 GitHub。"
        : "已保存到本机草稿；连接 GitHub 后会自动同步。",
    );
  }
  function remove(kind: EditableKind, id: string) {
    if (kind === "profile") throw new Error("档案不能删除");
    persist({
      version: 1,
      savedAt: new Date().toISOString(),
      operations: stageOperation(base, applied.remaining, kind, id, null),
    });
    setToast(
      connectionRef.current
        ? "删除已保存，正在自动同步到 GitHub。"
        : "已加入删除草稿；连接 GitHub 后会自动同步。",
    );
  }
  function restore(kind: EditableKind, id: string) {
    persist({
      ...draft,
      savedAt: new Date().toISOString(),
      operations: draft.operations.filter(
        (o) => o.kind !== kind || o.id !== id,
      ),
    });
  }
  function resetDamagedDraft() {
    rawRef.current = localStorage.getItem(draftKey);
    persist(emptyDraft());
  }
  function importDraft(input: unknown) {
    const merged = mergeDrafts(
      { ...draft, operations: applied.remaining },
      parseDraft(input),
    );
    applyOperations(base, merged.operations);
    persist(merged);
    setToast(
      connectionRef.current
        ? "草稿已恢复，正在准备自动同步。"
        : "草稿已恢复到本机；连接 GitHub 后会自动同步。",
    );
  }
  function acknowledge(sha: string, sent: Operation[]) {
    const raw = localStorage.getItem(draftKey);
    const latest = raw ? parseDraft(JSON.parse(raw)) : emptyDraft();
    const ops = latest.operations.map((op) => {
      const match = sent.find((s) => s.kind === op.kind && s.id === op.id);
      return match ? { ...op, submitted: { sha, after: match.after } } : op;
    });
    rawRef.current = raw;
    persist({ ...latest, savedAt: new Date().toISOString(), operations: ops });
    setToast("已自动同步到 GitHub，其他设备刷新即可查看。");
  }
  function resolve(remote: DiaryData, op: Operation, keepLocal: boolean) {
    const operations = applied.remaining.filter(
      (o) => o.kind !== op.kind || o.id !== op.id,
    );
    if (keepLocal)
      operations.push({
        ...op,
        before: entryAt(remote, op.kind, op.id),
        submitted: undefined,
      });
    persist({ ...draft, savedAt: new Date().toISOString(), operations });
    setBase(remote);
    queueRef.current!.retry();
  }
  return {
    data: applied.data,
    base,
    draft: { ...draft, operations: applied.remaining },
    conflicts: applied.conflicts,
    pending,
    error,
    editor,
    setEditor,
    toast,
    setToast,
    save,
    remove,
    restore,
    resetDamagedDraft,
    importDraft,
    acknowledge,
    resolve,
    connected: !!connection,
    remembered: connection?.remember ?? false,
    connecting,
    connect,
    disconnect,
    syncStatus,
    retrySync,
    refreshLatest,
    remoteConflict,
    setRemoteConflict,
  };
}
export function DiaryProvider({ children }: { children: ReactNode }) {
  const value = useDiaryState();
  return (
    <DiaryContext.Provider value={value}>{children}</DiaryContext.Provider>
  );
}
export function useDiary() {
  const value = useContext(DiaryContext);
  if (!value) throw new Error("DiaryProvider is missing");
  return value;
}
