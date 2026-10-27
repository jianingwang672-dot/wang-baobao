import { useState } from "react";
import ConnectionPanel from "./ConnectionPanel";
import {
  Download,
  Upload,
  CloudUpload,
  NotebookPen,
  ArrowUpRight,
  Undo2,
} from "lucide-react";
import { useDiary } from "../lib/DiaryContext";
import {
  editableKinds,
  kindNames,
  draftKey,
  isPending,
  type Operation,
} from "../lib/drafts";
import { csv, today } from "../lib/diary";
import {
  publishDraft,
  PublishConflict,
  repository,
} from "../lib/github-publish";
import type { Collection, DiaryData } from "../lib/schema";
import { AddRecordButton } from "./RecordEditor";
import { Modal } from "./Shared";
const download = (name: string, value: string, type = "application/json") => {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export default function DataManager() {
  const {
    data,
    draft,
    pending,
    error,
    restore,
    resetDamagedDraft,
    importDraft,
    connected,
    remoteConflict,
    setRemoteConflict,
    conflicts,
    resolve,
    setToast,
  } = useDiary();
  const [damagedReset, setDamagedReset] = useState(false);
  const [rawBackedUp, setRawBackedUp] = useState(false);
  const [message, setMessage] = useState("");
  const [collection, setCollection] = useState<Collection>("weights");
  const [discard, setDiscard] = useState<Operation | null>(null);
  async function readFile(file: File) {
    try {
      if (file.size > 2 * 1024 * 1024)
        throw new Error("草稿文件超过 2 MB，请检查是否选择正确。");
      const parsed = JSON.parse(await file.text());
      importDraft(parsed);
      setMessage(
        connected
          ? "草稿已恢复，将自动同步到 GitHub。"
          : "草稿已恢复到本机，连接后将自动同步。",
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const displayOp = (op: Operation) => {
    const row = op.after ?? op.before;
    return row && "date" in row
      ? `${row.date} · ${"food" in row ? row.food : "grams" in row ? `${row.grams} g` : "title" in row ? row.title : row.kind === "shedding" ? "蜕皮" : "健康观察"}`
      : "基本信息更新";
  };
  return (
    <>
      <header className="page-heading">
        <span className="eyebrow">WRITE A LITTLE, KEEP IT SAFE</span>
        <h1>
          把今天，好好记下来<span className="title-dot">.</span>
        </h1>
        <p>
          连接 GitHub 后，保存就会自动同步。每一份真实记录，都有长久的归处。
        </p>
      </header>
      <section className="panel quick-entry">
        <div>
          <h2>今天想记些什么？</h2>
          <p>保存后立即显示，已连接的设备会自动同步到 GitHub。</p>
        </div>
        <div className="quick-entry-buttons">
          {editableKinds.map((kind) => (
            <AddRecordButton key={kind} kind={kind} />
          ))}
        </div>
      </section>
      <div className="manage-grid writing-grid">
        <section className="panel">
          <div className="manage-icon">
            <NotebookPen />
          </div>
          <h2>本机草稿 · {pending.length} 项待同步</h2>
          <p>
            {connected
              ? "以下记录正在等待自动同步；网络失败时会保留在本机并重试。"
              : "尚未连接 GitHub。填写的数据先保留在本机，连接后自动同步。"}
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {error && (
            <div className="backup-buttons">
              <button
                className="outline-button"
                onClick={() => {
                  try {
                    const raw = localStorage.getItem(draftKey);
                    if (!raw) throw new Error("没有可读取的草稿原文");
                    download("baobao-draft-recovery.txt", raw, "text/plain");
                    setRawBackedUp(true);
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                下载草稿原文
              </button>
              <button
                className="outline-button"
                disabled={!rawBackedUp}
                onClick={() => setDamagedReset(true)}
              >
                备份后重新开始
              </button>
            </div>
          )}
          {draft.operations.length ? (
            <div className="draft-list">
              {draft.operations.map((op) => (
                <article key={`${op.kind}:${op.id}`}>
                  <div>
                    <span className="draft-tag">
                      {op.after === null
                        ? "删除"
                        : op.before === null
                          ? "新增"
                          : "修改"}{" "}
                      · {kindNames[op.kind]}
                    </span>
                    <strong>{displayOp(op)}</strong>
                    {op.submitted && (
                      <small>
                        <a
                          href={`https://github.com/${repository}/commit/${op.submitted.sha}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          已提交版本 {op.submitted.sha.slice(0, 7)} ↗
                        </a>
                      </small>
                    )}
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`撤销${kindNames[op.kind]}草稿`}
                    disabled={!isPending(op)}
                    title={
                      !isPending(op)
                        ? "已提交的内容请通过编辑或删除来修改"
                        : "撤销本机草稿"
                    }
                    onClick={() => setDiscard(op)}
                  >
                    <Undo2 size={15} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="draft-clear">
              <NotebookPen size={30} />
              <p>
                本机没有待同步记录。
                <br />
                点“记一笔”，开始今天的手账。
              </p>
            </div>
          )}
          {conflicts.length > 0 && (
            <p className="form-error">
              有 {conflicts.length}{" "}
              条记录与当前版本冲突。导出备份后，可撤销对应草稿，或在同步设置中核对版本。
            </p>
          )}
          <div className="backup-buttons">
            <button
              className="outline-button"
              onClick={() =>
                download(
                  `baobao-draft-${today()}.json`,
                  JSON.stringify(draft, null, 2),
                )
              }
            >
              <Download size={15} />
              导出草稿文件
            </button>
            <label className="outline-button file-label">
              <Upload size={15} />
              恢复草稿
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void readFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="manager-hint">
            不想配置令牌？将导出的草稿文件发给
            Codex，即可代为发布；删除和修改也会完整保留。
          </p>
        </section>
        <ConnectionPanel />
      </div>
      {message && (
        <p className="manager-message" role="status">
          {message}
        </p>
      )}
      {remoteConflict && (
        <section className="panel conflict-panel">
          <h2>同一条记录有两个版本</h2>
          <p>先核对内容，再决定保留哪个版本。其他记录不会被覆盖。</p>
          {remoteConflict.ops.map((op) => (
            <article key={`${op.kind}:${op.id}`}>
              <strong>
                {kindNames[op.kind]} · {op.id}
              </strong>
              <div className="conflict-values">
                <pre>网页草稿：{JSON.stringify(op.after, null, 2)}</pre>
                <pre>
                  GitHub：
                  {JSON.stringify(
                    op.kind === "profile"
                      ? remoteConflict.data.profile
                      : (remoteConflict.data[op.kind].find(
                          (r) => r.id === op.id,
                        ) ?? null),
                    null,
                    2,
                  )}
                </pre>
              </div>
              <div className="backup-buttons">
                <button
                  className="outline-button"
                  onClick={() => {
                    resolve(remoteConflict.data, op, true);
                    setRemoteConflict((c) =>
                      c ? { ...c, ops: c.ops.filter((o) => o !== op) } : null,
                    );
                  }}
                >
                  保留网页草稿并重新同步
                </button>
                <button
                  className="outline-button"
                  onClick={() => {
                    resolve(remoteConflict.data, op, false);
                    setRemoteConflict((c) =>
                      c ? { ...c, ops: c.ops.filter((o) => o !== op) } : null,
                    );
                  }}
                >
                  采用 GitHub 版本
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      <section className="panel mt backup-panel">
        <h2>导出数据备份</h2>
        <p>
          当前数据导出包含本机草稿；照片文件需要另行备份仓库中的 public/photos。
        </p>
        <div className="backup-buttons">
          <button
            className="outline-button"
            onClick={() =>
              download(
                `baobao-data-${today()}.json`,
                JSON.stringify(data, null, 2),
              )
            }
          >
            <Download size={15} />
            导出当前数据 JSON（含草稿）
          </button>
          <label className="csv-select">
            CSV 类型
            <select
              value={collection}
              onChange={(e) => setCollection(e.target.value as Collection)}
            >
              {Object.entries({
                weights: "体重",
                feedings: "喂食",
                shedding: "蜕皮与健康",
                milestones: "成长事件",
                photos: "照片索引",
              }).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="outline-button"
            onClick={() =>
              download(
                `baobao-${collection}-${today()}.csv`,
                csv(data[collection]),
                "text/csv;charset=utf-8",
              )
            }
          >
            <Download size={15} />
            导出 CSV
          </button>
        </div>
      </section>
      {damagedReset && (
        <Modal label="重新开始本机草稿" onClose={() => setDamagedReset(false)}>
          <div className="confirm-content">
            <h2>确认已保存草稿原文？</h2>
            <p>
              重新开始会移除本机损坏草稿，不会修改 GitHub。原文备份可交给 Codex
              恢复。
            </p>
            <div className="form-buttons">
              <button
                className="outline-button"
                onClick={() => setDamagedReset(false)}
              >
                取消
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  try {
                    resetDamagedDraft();
                    setDamagedReset(false);
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                确认重新开始
              </button>
            </div>
          </div>
        </Modal>
      )}
      {discard && (
        <Modal label="撤销草稿" onClose={() => setDiscard(null)}>
          <div className="confirm-content">
            <h2>撤销这项本机草稿？</h2>
            <p>
              本机将恢复为当前网站版本。已提交到 GitHub
              的内容不会被回滚；如需修改已发布记录，请使用编辑或删除。
            </p>
            <div className="form-buttons">
              <button
                className="outline-button"
                onClick={() => setDiscard(null)}
              >
                保留草稿
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  try {
                    restore(discard.kind, discard.id);
                    setDiscard(null);
                  } catch (e) {
                    setMessage((e as Error).message);
                  }
                }}
              >
                确认撤销
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
