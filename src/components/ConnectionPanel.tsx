import { useState } from "react";
import {
  CloudUpload as CloudCheck,
  Link,
  Unplug,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useDiary } from "../lib/DiaryContext";
import { repository } from "../lib/github-publish";
export default function ConnectionPanel() {
  const {
    connected,
    remembered,
    connecting,
    connect,
    disconnect,
    pending,
    syncStatus,
    retrySync,
    refreshLatest,
  } = useDiary();
  const [token, setToken] = useState("");
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState("");
  async function connectNow() {
    setMessage("");
    try {
      await connect(token, remember);
    } catch (e) {
      setMessage((e as Error).message || "连接失败，请检查授权和浏览器存储。");
    } finally {
      setToken("");
    }
  }
  return (
    <section className="panel connection-panel">
      <div className="manage-icon">
        <CloudCheck />
      </div>
      <h2>{connected ? "保存，就会自动同步" : "连接一次，之后自动同步"}</h2>
      <p>
        {connected
          ? "每次新增、编辑或删除后，都会自动写入 GitHub。其他设备刷新即可看到新记录；打开的页面会定期获取更新。"
          : "首次连接用于确认你有权修改这本手账。连接后不用再导出文件或手动点发布。"}
      </p>
      {connected ? (
        <>
          <div
            className={`connection-state ${["error", "conflict"].includes(syncStatus.phase) ? "attention" : ""}`}
            role="status"
          >
            <ShieldCheck size={20} />
            <div>
              <strong>
                {syncStatus.phase === "syncing"
                  ? "正在自动同步…"
                  : pending.length
                    ? `${pending.length} 项记录等待同步`
                    : "已连接 · 自动同步已开启"}
              </strong>
              <span>{syncStatus.message}</span>
              <small>
                {remembered
                  ? "已记住这台设备；关闭浏览器后仍可自动连接。"
                  : "当前标签页已连接；刷新仍有效，关闭标签页后需重新连接。"}
              </small>
            </div>
          </div>
          <div className="backup-buttons">
            <button
              className="outline-button"
              disabled={syncStatus.phase === "syncing"}
              onClick={retrySync}
            >
              <RefreshCw size={15} />
              立即同步
            </button>
            <button
              className="outline-button"
              onClick={() => {
                try {
                  disconnect();
                  setMessage("已断开连接并清除本机保存的令牌。");
                } catch {
                  setMessage(
                    "连接已停止，但浏览器未能清除令牌，请检查站点存储。",
                  );
                }
              }}
            >
              <Unplug size={15} />
              断开连接
            </button>
          </div>
          {syncStatus.url && (
            <a
              className="text-link deployment-link"
              href={syncStatus.url}
              target="_blank"
              rel="noreferrer"
            >
              查看最近一次同步 ↗
            </a>
          )}
        </>
      ) : (
        <>
          <details className="token-help">
            <summary>首次连接：获取 GitHub 连接令牌</summary>
            <ol>
              <li>
                打开{" "}
                <a
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub 细粒度令牌设置 ↗
                </a>
                。
              </li>
              <li>
                Resource owner 选择 <strong>jianingwang672-dot</strong>。
              </li>
              <li>
                Repository access 选择{" "}
                <strong>Only select repositories → wang-baobao</strong>。
              </li>
              <li>
                仅将 <strong>Contents</strong> 设为{" "}
                <strong>Read and write</strong>，创建后粘贴在下面。
              </li>
            </ol>
            <p>
              令牌不要发到聊天、写进代码或分享给访客。只在你自己的设备连接。
            </p>
          </details>
          <label className="editor-field token-label">
            GitHub 连接令牌
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              placeholder="首次连接时粘贴"
              disabled={connecting}
            />
          </label>
          <label className="remember-device">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={connecting}
            />
            <span>
              记住这台私人设备
              <small>
                勾选后会把令牌保存在当前浏览器，直到断开连接；公用设备请勿勾选。未勾选时只保留在当前标签页。
              </small>
            </span>
          </label>
          <button
            className="primary-button full"
            disabled={connecting || !token.trim()}
            onClick={connectNow}
          >
            <Link size={16} />
            {connecting ? "正在验证连接权限…" : "连接 GitHub 并开启自动同步"}
          </button>
          <p className="manager-hint">
            连接后，现有的 {pending.length}{" "}
            项本机修改也会自动同步。令牌不会出现在源码、草稿备份或公开网页中。
          </p>
        </>
      )}
      {message && (
        <p className="form-error" role="status">
          {message}
        </p>
      )}
      <div className="sync-reading-note">
        <p>
          正式记录仍保存在
          GitHub。网络失败时，本机会保留待同步记录并自动重试。令牌过期或记录冲突时会提示处理。
        </p>
        <button className="text-link" onClick={() => void refreshLatest()}>
          获取 GitHub 最新记录 <RefreshCw size={12} />
        </button>
        <a
          className="text-link"
          href={`https://github.com/${repository}`}
          target="_blank"
          rel="noreferrer"
        >
          查看公开仓库 ↗
        </a>
      </div>
    </section>
  );
}
