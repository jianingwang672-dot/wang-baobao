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
// The token is only passed in this function's request headers, never URLs, storage, or exports.
export async function publishDraft(
  token: string,
  operations: Operation[],
  request: Request = fetch,
) {
  if (!token.trim())
    throw new Error("请填写仅限 wang-baobao 仓库的 GitHub 令牌。");
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token.trim()}`,
    "Content-Type": "application/json",
  };
  async function call(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<any> {
    let response: Response;
    try {
      response = await request(`${api}${path}`, {
        method,
        headers,
        cache: "no-store",
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new Error(
        "网络请求未完成。草稿仍保留；请检查 GitHub 的最新提交后重试。",
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
      throw new Error(
        explanations[response.status] ??
          `GitHub 请求失败（${response.status}），草稿未清除。`,
      );
    }
    return response.json();
  }
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
  };
}
