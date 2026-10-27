import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, NotebookPen, Check, Undo2 } from "lucide-react";
import { useDiary } from "../lib/DiaryContext";
import {
  entryAt,
  kindNames,
  isPending,
  type EditableKind,
} from "../lib/drafts";
import { today } from "../lib/diary";
import { Modal } from "./Shared";

export function AddRecordButton({
  kind = "feedings",
  compact = false,
}: {
  kind?: EditableKind;
  compact?: boolean;
}) {
  const { setEditor } = useDiary();
  return (
    <button
      className={compact ? "header-add" : "primary-button"}
      onClick={() => setEditor({ kind })}
    >
      <Plus size={16} />
      {compact
        ? "记一笔"
        : kind === "profile"
          ? "编辑豹豹档案"
          : `新增${kindNames[kind]}`}
    </button>
  );
}
export function EntryActions({ kind, id }: { kind: EditableKind; id: string }) {
  const { setEditor, remove, draft, connected } = useDiary();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const op = draft.operations.find((o) => o.kind === kind && o.id === id);
  return (
    <div className="entry-actions">
      {op && (
        <span className="draft-tag">
          {!isPending(op) ? "已提交" : "本机草稿"}
        </span>
      )}
      <button
        aria-label={`编辑${kindNames[kind]}`}
        onClick={() => setEditor({ kind, id })}
      >
        <Pencil size={13} />
        编辑
      </button>
      {kind !== "profile" && (
        <button
          aria-label={`删除${kindNames[kind]}`}
          onClick={() => setConfirm(true)}
        >
          <Trash2 size={13} />
          删除
        </button>
      )}
      {confirm && (
        <Modal label="确认删除记录" onClose={() => setConfirm(false)}>
          <div className="confirm-content">
            <span className="eyebrow">KEEP ONLY WHAT IS TRUE</span>
            <h2>删除这条{kindNames[kind]}？</h2>
            <p>
              {connected
                ? "确认后会自动删除 GitHub 中的这条记录，其他设备也会更新。"
                : "会先加入本机删除草稿，连接 GitHub 后自动同步删除。"}
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-buttons">
              <button
                className="outline-button"
                onClick={() => setConfirm(false)}
              >
                保留记录
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  try {
                    remove(kind, id);
                    setConfirm(false);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {connected ? "删除并自动同步" : "加入删除草稿"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function DraftStatus() {
  const { draft, pending, conflicts, error, connected, syncStatus } =
    useDiary();
  if (!draft.operations.length && !error && !connected)
    return (
      <div className="sync-connect-hint">
        <span>想让记录自动同步？</span>
        <a href="#manage">连接 GitHub 一次 ↗</a>
      </div>
    );
  return (
    <div
      className={`draft-status ${error || conflicts.length ? "has-error" : ""}`}
      role="status"
    >
      <NotebookPen size={18} />
      <div>
        <strong>
          {error
            ? "草稿存储需要处理"
            : conflicts.length
              ? `${conflicts.length} 条记录需要核对`
              : pending.length
                ? connected
                  ? syncStatus.message
                  : `本机有 ${pending.length} 项待同步修改`
                : connected
                  ? "已连接 · 自动同步已开启"
                  : "已同步到 GitHub"}
        </strong>
        <span>
          {error ||
            (pending.length
              ? connected
                ? "记录会自动提交；同步成功前会安全保留在本机。"
                : "连接 GitHub 后会自动同步，不需要手动导出。"
              : "正式记录保存在 GitHub，其他设备刷新即可获取最新记录。")}
        </span>
      </div>
      <a href="#manage">
        {error || conflicts.length
          ? "查看详情"
          : pending.length
            ? "同步设置"
            : "查看提交"}
        <span>↗</span>
      </a>
    </div>
  );
}
function RecordForm({ kind, id }: { kind: EditableKind; id?: string }) {
  const { data, save, setEditor, connected } = useDiary();
  const [original] = useState(() => entryAt(data, kind, id ?? ""));
  const [error, setError] = useState("");
  const [changed, setChanged] = useState(false);
  const [discard, setDiscard] = useState(false);
  const source = (original ?? {}) as Record<string, unknown>;
  const text = (name: string, fallback = "") =>
    String(source[name] ?? fallback);
  const bool = (name: string) =>
    source[name] === true
      ? "true"
      : source[name] === false
        ? "false"
        : "unknown";
  const [healthKind, setHealthKind] = useState(text("kind", "shedding"));
  const close = () => (changed ? setDiscard(true) : setEditor(null));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const val = (key: string) => String(form.get(key) ?? "").trim();
    const tri = (key: string) =>
      val(key) === "true" ? true : val(key) === "false" ? false : null;
    const number = (key: string) => (val(key) === "" ? null : Number(val(key)));
    const date = val("date");
    try {
      if (kind !== "profile" && date > today())
        throw new Error("只能记录已经发生的事，请选择今天或更早的日期。");
      const recordId = id ?? `${kind}-${crypto.randomUUID()}`;
      let record: unknown;
      if (kind === "profile") {
        if (
          (val("arrivalDate") && val("arrivalDate") > today()) ||
          (val("birthDate") && val("birthDate") > today()) ||
          (val("estimatedBirthMonth") &&
            val("estimatedBirthMonth") > today().slice(0, 7))
        )
          throw new Error("生日和到家日期不能晚于今天。");
        record = {
          ...data.profile,
          name: val("name"),
          englishName: val("englishName"),
          birthDate: val("birthDate") || null,
          estimatedBirthMonth: val("estimatedBirthMonth") || null,
          arrivalDate: val("arrivalDate") || null,
          sex: val("sex"),
          morph: val("morph") || null,
          appearance: val("appearance"),
        };
      } else {
        const common = { id: recordId, date, notes: val("notes") };
        record =
          kind === "weights"
            ? { ...common, grams: number("grams") }
            : kind === "feedings"
              ? {
                  ...common,
                  food: val("food"),
                  quantity: number("quantity"),
                  unit: val("unit"),
                  normal: tri("normal"),
                  supplements: val("supplements"),
                }
              : kind === "shedding"
                ? {
                    ...common,
                    kind: healthKind,
                    complete:
                      healthKind === "shedding" ? tri("complete") : null,
                    retainedSkin:
                      healthKind === "shedding" ? tri("retainedSkin") : null,
                    mood: val("mood"),
                    stool: val("stool"),
                  }
                : {
                    ...common,
                    title: val("title"),
                    description: val("description"),
                  };
      }
      save(kind, kind === "profile" ? "profile" : recordId, record, original);
      setEditor(null);
    } catch (e) {
      const issue = e as { issues?: { message: string }[]; message?: string };
      setError(
        issue.issues
          ? "请检查日期、必填项和数字。体重应大于 0，食物数量应为非负整数。"
          : (issue.message ?? "保存失败，请检查输入。"),
      );
    }
  }
  const field = (
    label: string,
    name: string,
    options: {
      type?: string;
      required?: boolean;
      placeholder?: string;
      min?: string;
      step?: string;
      fallback?: string;
    } = {},
  ) => (
    <label className="editor-field">
      {label}
      {options.required && <span className="required-mark"> *</span>}
      <input
        name={name}
        type={options.type ?? "text"}
        defaultValue={text(name, options.fallback)}
        required={options.required}
        placeholder={options.placeholder}
        min={options.min}
        step={options.step}
        max={
          options.type === "date"
            ? today()
            : options.type === "month"
              ? today().slice(0, 7)
              : undefined
        }
        maxLength={options.type === "text" || !options.type ? 300 : undefined}
      />
    </label>
  );
  const triField = (label: string, name: string) => (
    <label className="editor-field">
      {label}
      <select name={name} defaultValue={bool(name)}>
        <option value="unknown">未知 / 待记录</option>
        <option value="true">是</option>
        <option value="false">否</option>
      </select>
    </label>
  );
  return (
    <Modal label={`${id ? "编辑" : "新增"}${kindNames[kind]}`} onClose={close}>
      <div className="editor-heading">
        <span className="eyebrow">A LITTLE NOTE FOR BAOBAO</span>
        <h2>
          {kind === "profile"
            ? "更新豹豹档案"
            : `${id ? "编辑" : "记一笔"}${kindNames[kind]}`}
        </h2>
        <p>记录真实发生的小事，不确定的内容可以留空。</p>
      </div>
      {!id && kind !== "profile" && (
        <div className="editor-tabs" aria-label="记录类型">
          {(["feedings", "weights", "shedding", "milestones"] as const).map(
            (k) => (
              <button
                key={k}
                aria-pressed={kind === k}
                onClick={() => {
                  if (changed) {
                    setError("请先保存当前表单，或关闭后再切换类型。");
                    return;
                  }
                  setEditor({ kind: k });
                }}
              >
                {kindNames[k]}
              </button>
            ),
          )}
        </div>
      )}
      <form
        className="entry-form"
        onSubmit={submit}
        onChange={() => setChanged(true)}
      >
        <div className="form-grid">
          {kind !== "profile" &&
            field("记录日期", "date", {
              type: "date",
              required: true,
              fallback: today(),
            })}
          {kind === "feedings" && (
            <>
              {field("食物种类", "food", {
                required: true,
                placeholder: "如：蟋蟀、杜比亚",
              })}
              {field("数量（不知道可留空）", "quantity", {
                type: "number",
                min: "0",
                step: "1",
              })}
              {field("数量单位", "unit", { required: true, fallback: "只" })}
              {triField("是否正常进食", "normal")}
              {field("补钙 / 维生素", "supplements", {
                placeholder: "按实际使用情况填写",
              })}
            </>
          )}
          {kind === "weights" &&
            field("体重（g）", "grams", {
              type: "number",
              required: true,
              min: "0.01",
              step: "any",
              placeholder: "输入实际称重克数",
            })}
          {kind === "shedding" && (
            <>
              <label className="editor-field">
                记录类型
                <select
                  name="kind"
                  value={healthKind}
                  onChange={(e) => setHealthKind(e.target.value)}
                >
                  <option value="shedding">蜕皮记录</option>
                  <option value="observation">日常健康观察</option>
                </select>
              </label>
              {healthKind === "shedding" && (
                <>
                  {triField("是否完整蜕皮", "complete")}
                  {triField("是否有残留皮", "retainedSkin")}
                </>
              )}
              {field("精神状态", "mood", {
                placeholder: "记录实际观察，未知可留空",
              })}
              {field("排便情况", "stool", { placeholder: "未知可留空" })}
            </>
          )}
          {kind === "milestones" && (
            <>
              {field("事件标题", "title", {
                required: true,
                placeholder: "为已经发生的事情取个名字",
              })}
              <label className="editor-field form-wide">
                事件描述
                <textarea
                  name="description"
                  defaultValue={text("description")}
                  rows={3}
                  maxLength={5000}
                />
              </label>
            </>
          )}
          {kind === "profile" && (
            <>
              {field("中文名", "name", { required: true })}
              {field("英文名", "englishName", { required: true })}
              {field("估计出生月份", "estimatedBirthMonth", { type: "month" })}
              {field("确切生日（确认后再填）", "birthDate", { type: "date" })}
              {field("到家日期", "arrivalDate", { type: "date" })}
              <label className="editor-field">
                性别
                <select name="sex" defaultValue={text("sex", "unknown")}>
                  <option value="unknown">未知</option>
                  <option value="male">雄性（已确认）</option>
                  <option value="female">雌性（已确认）</option>
                </select>
              </label>
              {field("品系（不确定请留空）", "morph")}
              {field("体色观察", "appearance")}
            </>
          )}
          {kind !== "profile" && (
            <label className="editor-field form-wide">
              {kind === "shedding" ? "其他健康观察 / 备注" : "备注"}
              <textarea
                name="notes"
                rows={3}
                defaultValue={text("notes")}
                maxLength={5000}
              />
            </label>
          )}
        </div>
        <div className="local-save-note">
          <NotebookPen size={17} />
          <p>
            {connected
              ? "已开启自动同步。保存后会自动写入 GitHub，失败时保留记录并重试。"
              : "尚未连接 GitHub，先保存到本机。连接一次后，新增、编辑和删除都会自动同步。"}
          </p>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {discard ? (
          <div className="discard-inline">
            <p>这份表单尚未保存，要放弃填写吗？</p>
            <div className="form-buttons">
              <button
                type="button"
                className="outline-button"
                onClick={() => setDiscard(false)}
              >
                继续填写
              </button>
              <button
                type="button"
                className="outline-button"
                onClick={() => setEditor(null)}
              >
                放弃这份表单
              </button>
            </div>
          </div>
        ) : (
          <div className="form-buttons">
            <button type="button" className="outline-button" onClick={close}>
              取消
            </button>
            <button className="primary-button" type="submit">
              <Check size={16} />
              {connected ? "保存并自动同步" : "保存到本机草稿"}
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
export function DiaryOverlays() {
  const { editor, toast, setToast } = useDiary();
  return (
    <>
      {editor && (
        <RecordForm key={`${editor.kind}:${editor.id ?? "new"}`} {...editor} />
      )}{" "}
      {toast && (
        <div className="diary-toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <a href="#manage" onClick={() => setToast("")}>
            同步设置
          </a>
          <button onClick={() => setToast("")} aria-label="关闭提示">
            ×
          </button>
        </div>
      )}
    </>
  );
}
