import { readFile, writeFile, rename, access } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateData,
  type DiaryData,
  type Collection,
} from "../src/lib/schema";
export const root = fileURLToPath(new URL("../", import.meta.url));
export const dataPath = (name: string) =>
  resolve(root, "src/data", `${name}.json`);
export async function load() {
  const keys = [
    "profile",
    "weights",
    "feedings",
    "shedding",
    "milestones",
    "photos",
  ];
  return validateData(
    Object.fromEntries(
      await Promise.all(
        keys.map(async (key) => [
          key,
          JSON.parse(await readFile(dataPath(key), "utf8")),
        ]),
      ),
    ),
  );
}
export async function checkAssets(data: DiaryData) {
  for (const p of data.photos)
    for (const path of [p.src, p.thumbnail])
      await access(resolve(root, "public", path));
}
export async function save(name: Collection | "profile", value: unknown) {
  const all = await load();
  const next = validateData({ ...all, [name]: value });
  await checkAssets(next);
  const path = dataPath(name),
    temp = `${path}.tmp`;
  await writeFile(temp, JSON.stringify(next[name], null, 2) + "\n");
  await rename(temp, path);
}
