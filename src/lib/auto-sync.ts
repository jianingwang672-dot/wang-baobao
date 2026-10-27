import type { Operation } from "./drafts";
import {
  GitHubError,
  PublishConflict,
  type PublishResult,
} from "./github-publish";
export type SyncPhase =
  | "disconnected"
  | "idle"
  | "queued"
  | "syncing"
  | "synced"
  | "offline"
  | "error"
  | "conflict";
export type SyncStatus = {
  phase: SyncPhase;
  message: string;
  retryAt?: number;
  url?: string;
};
export const retryDelay = (attempt: number) =>
  Math.min(60000, 5000 * 2 ** Math.min(Math.max(attempt - 1, 0), 4));
type Dependencies = {
  getOperations: () => Operation[];
  publish: (
    operations: Operation[],
    signal: AbortSignal,
  ) => Promise<PublishResult>;
  accept: (result: PublishResult, sent: Operation[]) => void;
  onStatus: (status: SyncStatus) => void;
  onConflict: (error: PublishConflict) => void;
  online: () => boolean;
  delay?: number;
  schedule?: (
    callback: () => void,
    ms: number,
  ) => ReturnType<typeof setTimeout>;
  cancel?: (timer: ReturnType<typeof setTimeout>) => void;
};
// One queue drains all saved edits, including edits made while a previous request is running.
export class AutoSyncQueue {
  private enabled = false;
  private running = false;
  private blocked = false;
  private failures = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private revision = 0;
  constructor(private dependencies: Dependencies) {}
  private cancelTimer() {
    if (this.timer !== undefined)
      (this.dependencies.cancel ?? clearTimeout)(this.timer);
    this.timer = undefined;
  }
  activate() {
    this.enabled = true;
    this.blocked = false;
    this.failures = 0;
    this.dependencies.onStatus({
      phase: "idle",
      message: "GitHub 已连接，保存后会自动同步。",
    });
    this.notify(0);
  }
  pause() {
    this.enabled = false;
    this.revision++;
    this.cancelTimer();
    this.controller?.abort();
    this.dependencies.onStatus({
      phase: "disconnected",
      message: "尚未连接 GitHub；记录先保存在本机。",
    });
  }
  notify(delay = this.dependencies.delay ?? 700) {
    if (!this.enabled || this.running || this.blocked) return;
    this.cancelTimer();
    if (!this.dependencies.getOperations().length) return;
    if (!this.dependencies.online()) {
      this.dependencies.onStatus({
        phase: "offline",
        message: "当前离线，记录已保留；联网后自动同步。",
      });
      return;
    }
    this.dependencies.onStatus({
      phase: "queued",
      message: "记录已保存，正在准备自动同步…",
    });
    this.timer = (this.dependencies.schedule ?? setTimeout)(() => {
      this.timer = undefined;
      void this.drain();
    }, delay);
  }
  retry() {
    this.blocked = false;
    this.failures = 0;
    this.notify(0);
  }
  private async drain() {
    if (!this.enabled || this.running || this.blocked) return;
    if (!this.dependencies.online()) {
      this.dependencies.onStatus({
        phase: "offline",
        message: "当前离线，记录已保留；联网后自动同步。",
      });
      return;
    }
    const operations = this.dependencies.getOperations();
    if (!operations.length) return;
    const revision = this.revision;
    this.running = true;
    this.controller = new AbortController();
    this.dependencies.onStatus({
      phase: "syncing",
      message: "正在自动同步到 GitHub…",
    });
    try {
      const result = await this.dependencies.publish(
        operations,
        this.controller.signal,
      );
      this.dependencies.accept(result, operations);
      this.failures = 0;
      if (this.enabled && revision === this.revision)
        this.dependencies.onStatus({
          phase: "synced",
          message: "已同步到 GitHub，其他设备刷新即可查看。",
          url: result.url,
        });
    } catch (error) {
      if (!this.enabled || revision !== this.revision) return;
      if (error instanceof PublishConflict) {
        this.blocked = true;
        this.dependencies.onConflict(error);
        this.dependencies.onStatus({
          phase: "conflict",
          message: "同一条记录有不同版本，请在同步设置中核对。",
        });
      } else if (error instanceof GitHubError && !error.retryable) {
        this.blocked = true;
        this.dependencies.onStatus({ phase: "error", message: error.message });
      } else {
        this.failures++;
        const delay = retryDelay(this.failures);
        this.dependencies.onStatus({
          phase: "error",
          message: "暂未同步成功，记录已保留；稍后自动重试。",
          retryAt: Date.now() + delay,
        });
        this.timer = (this.dependencies.schedule ?? setTimeout)(() => {
          this.timer = undefined;
          void this.drain();
        }, delay);
      }
    } finally {
      this.running = false;
      this.controller = undefined;
      if (
        this.enabled &&
        !this.blocked &&
        this.timer === undefined &&
        this.dependencies.getOperations().length
      )
        this.notify(0);
    }
  }
}
