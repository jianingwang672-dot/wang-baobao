import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { load, save, root, checkAssets } from "./store";
import { recordSchemas, type Collection } from "../src/lib/schema";
import { csv, today } from "../src/lib/diary";
import { applyOperations, parseDraft, entryAt, same } from "../src/lib/drafts";
async function main() {
  const [command, collection, arg] = process.argv.slice(2);
  const data = await load();
  if (command === "apply-draft") {
    if (!collection) throw new Error("请提供网页导出的 baobao-draft JSON 文件");
    const draft = parseDraft(
      JSON.parse(await readFile(resolve(collection), "utf8")),
    );
    const operations = draft.operations.filter(
      (op) => !same(entryAt(data, op.kind, op.id), op.after),
    );
    const merged = applyOperations(data, operations);
    if (merged.conflicts.length)
      throw new Error(
        "草稿与仓库同一条记录冲突，未写入。请核对：" +
          merged.conflicts.map((op) => op.id).join("、"),
      );
    await checkAssets(merged.data);
    for (const kind of new Set(operations.map((op) => op.kind)))
      await save(kind, merged.data[kind]);
    console.log(
      "网页草稿已合并到本地正式 JSON。请测试、构建、提交后再报告发布完成。",
    );
    return;
  }
  if (command === "validate") {
    await checkAssets(data);
    console.log("数据格式、唯一 ID、封面引用、照片文件校验通过。");
    return;
  }
  if (command === "export") {
    const dir = resolve(root, "exports", today());
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, "baobao.json"), JSON.stringify(data, null, 2));
    for (const k of Object.keys(recordSchemas) as Collection[])
      await writeFile(resolve(dir, `${k}.csv`), csv(data[k]));
    console.log(`已导出 ${dir}（照片需另外备份 public/photos）`);
    return;
  }
  if (command === "profile") {
    if (!collection)
      throw new Error("请提供含 profile 字段的完整 JSON 文件或 profile.json");
    let input = JSON.parse(await readFile(resolve(collection), "utf8"));
    input = input.profile ?? input;
    await save("profile", input);
    console.log("档案已更新");
    return;
  }
  if (!Object.hasOwn(recordSchemas, collection ?? ""))
    throw new Error(
      "用法：npm run data -- validate | export | profile 文件 | add/upsert/replace 集合 文件 | delete 集合 ID",
    );
  const key = collection as Collection;
  if (command === "delete") {
    if (!arg) throw new Error("请提供 ID");
    if (!data[key].some((r) => r.id === arg)) throw new Error("ID 不存在");
    await save(
      key,
      data[key].filter((r) => r.id !== arg),
    );
    console.log("记录已删除；照片文件保留，避免误删原图");
    return;
  }
  if (!["add", "upsert", "replace"].includes(command) || !arg)
    throw new Error("需要 add、upsert 或 replace，以及输入 JSON 文件路径");
  const raw = JSON.parse(await readFile(resolve(arg), "utf8"));
  const input = Array.isArray(raw) ? raw : [raw];
  const parsed = input.map((r) => recordSchemas[key].parse(r));
  const rows = command === "replace" ? parsed : [...data[key]];
  if (command !== "replace")
    for (const row of parsed) {
      const index = rows.findIndex((r) => r.id === row.id);
      if (index >= 0 && command === "add")
        throw new Error(`ID 已存在：${row.id}，修改请用 upsert`);
      if (index >= 0) rows[index] = row;
      else rows.push(row);
    }
  await save(key, rows);
  console.log(`${key} 已更新；请运行 npm run build，检查后提交推送。`);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
