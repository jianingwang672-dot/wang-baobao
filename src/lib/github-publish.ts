import { applyOperations, entryAt, same, type Operation } from "./drafts";
import { validateData, type DiaryData } from "./schema";
export const repository = "jianingwang672-dot/wang-baobao";
const api = `https://api.github.com/repos/${repository}`;
export class PublishConflict extends Error {
  constructor(
    public remote: DiaryData,
    public operations: Operation[],
  ) {
    super("同一条记录已在 GitHub 更新，请选择保留哪个版本。");
  }
}
type Request = typeof fetch;
export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryable: boolean,
  ) {
    super(message);
  }
}
export type PublishResult = {
  sha: string;
  url: string;
  alreadySaved: boolean;
  data: DiaryData;
};
// Credentials are only sent to api.github.com. Connection storage is handled separately.
function apiClient(token: string, request: Request, signal?: AbortSignal) {
  const headers = {
    Accept: "application/vnd.github+json",
    ...(token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
    "Content-Type": "application/json",
  };
  return async function call(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<any> {
    signal?.throwIfAborted();
    let response: Response;
    try {
      response = await request(`${api}${path}`, {
        method,
        headers,
        cache: "no-store",
        body: body ? JSON.stringify(body) : undefined,
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
          : AbortSignal.timeout(30000),
      });
    } catch {
      if (signal?.aborted)
        throw new DOMException("Sync cancelled", "AbortError");
      throw new GitHubError(
        "网络请求未完成，记录仍保留。请检查连接。",
        0,
        true,
      );
    }
    if (!response.ok) {
      const explanations: Record<number, string> = {
        401: "GitHub 令牌无效或已过期。",
        403: "没有仓库写入权限或 API 额度不足。请检查 Contents: Read and write。",
        404: "令牌没有授权 wang-baobao 仓库。",
        409: "仓库刚刚更新，请重试；不会覆盖他人的提交。",
        422: "仓库出现并发修改或提交被拒绝，请检查 GitHub 后重试。",
      };
      throw new GitHubError(
        explanations[response.status] ??
          `GitHub 请求失败（${response.status}），草稿未清除。`,
        response.status,
        response.status >= 500 ||
          response.status === 409 ||
          response.status === 422 ||
          (response.status === 403 &&
            response.headers.get("x-ratelimit-remaining") === "0"),
      );
    }
    return response.json();
  };
}
export async function verifyConnection(
  token: string,
  request: Request = fetch,
  signal?: AbortSignal,
) {
  if (!token.trim() || token.length > 500)
    throw new GitHubError(
      "请填写仅限 wang-baobao 仓库的 GitHub 令牌。",
      401,
      false,
    );
  const call = apiClient(token, request, signal);
  // A content-addressed empty blob verifies write permission without changing a branch or any diary data.
  await call("/git/blobs", "POST", { content: "", encoding: "utf-8" });
}
export async function readLatestDiary(
  knownSha?: string,
  token = "",
  request: Request = fetch,
  signal?: AbortSignal,
) {
  const head = await apiClient(token, request, signal)("/git/ref/heads/main");
  const sha = head.object.sha as string;
  if (!/^[a-f0-9]{40}$/.test(sha))
    throw new GitHubError("GitHub 返回的版本信息无效。", 0, true);
  if (sha === knownSha) return { sha, data: null };
  const keys = [
    "profile",
    "weights",
    "feedings",
    "shedding",
    "milestones",
    "photos",
  ];
  const values = await Promise.all(
    keys.map(async (key) => {
      const response = await request(
        `https://raw.githubusercontent.com/${repository}/${sha}/src/data/${key}.json`,
        {
          cache: "no-store",
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
            : AbortSignal.timeout(30000),
        },
      );
      if (!response.ok)
        throw new GitHubError(
          "暂时无法读取最新记录，仍保留当前页面内容。",
          response.status,
          true,
        );
      return [key, await response.json()];
    }),
  );
  return { sha, data: validateData(Object.fromEntries(values)) };
}
export async function publishDraft(
  token: string,
  operations: Operation[],
  request: Request = fetch,
  signal?: AbortSignal,
): Promise<PublishResult> {
  if (!token.trim()) throw new GitHubError("请先连接 GitHub。", 401, false);
  const call = apiClient(token, request, signal);
  const head = await call("/git/ref/heads/main");
  const parent = head.object.sha;
  const keys = [
    "profile",
    "weights",
    "feedings",
    "shedding",
    "milestones",
    "photos",
  ];
  const values = await Promise.all(
    keys.map(async (key) => {
      const file = await call(`/contents/src/data/${key}.json?ref=${parent}`);
      const bytes = Uint8Array.from(
        atob(file.content.replace(/\s/g, "")),
        (c) => c.charCodeAt(0),
      );
      return [key, JSON.parse(new TextDecoder().decode(bytes))];
    }),
  );
  const remote = validateData(Object.fromEntries(values));
  // A latest remote value equal to the desired one is already saved, including a retry after a lost response.
  const pending = operations.filter(
    (op) => !same(entryAt(remote, op.kind, op.id), op.after),
  );
  const merged = applyOperations(remote, pending);
  if (merged.conflicts.length)
    throw new PublishConflict(remote, merged.conflicts);
  if (!pending.length)
    return {
      sha: parent,
      url: `https://github.com/${repository}/commit/${parent}`,
      alreadySaved: true,
      data: remote,
    };
  const commit = await call(`/git/commits/${parent}`);
  const kinds = [...new Set(pending.map((op) => op.kind))];
  const tree = await call("/git/trees", "POST", {
    base_tree: commit.tree.sha,
    tree: kinds.map((kind) => ({
      path: `src/data/${kind}.json`,
      mode: "100644",
      type: "blob",
      content: JSON.stringify(merged.data[kind], null, 2) + "\n",
    })),
  });
  const created = await call("/git/commits", "POST", {
    message: `Update BaoBao diary (${pending.length} record changes)`,
    tree: tree.sha,
    parents: [parent],
  });
  // Never force: a concurrent write makes this update fail instead of overwriting history.
  await call("/git/refs/heads/main", "PATCH", {
    sha: created.sha,
    force: false,
  });
  return {
    sha: created.sha,
    url: `https://github.com/${repository}/commit/${created.sha}`,
    alreadySaved: false,
    data: merged.data,
  };
}
