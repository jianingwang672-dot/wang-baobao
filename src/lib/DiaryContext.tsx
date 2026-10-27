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
  const rawRef = useRef(initial.raw);
  const applied = applyOperations(base, draft.operations);
  const pending = applied.remaining.filter(isPending);
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
    setToast("已保存到本机草稿，尚未发布到 GitHub。");
  }
  function remove(kind: EditableKind, id: string) {
    if (kind === "profile") throw new Error("档案不能删除");
    persist({
      version: 1,
      savedAt: new Date().toISOString(),
      operations: stageOperation(base, applied.remaining, kind, id, null),
    });
    setToast("已加入删除草稿；发布后才会更新 GitHub。");
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
    setToast("已恢复为本机草稿，尚未发布。");
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
    setToast(
      "已提交到 GitHub。等待 Actions 部署完成后，所有设备才会看到更新。",
    );
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
