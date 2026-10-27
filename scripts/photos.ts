import { readFile, mkdir, access, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import exifr from "exifr";
import { root, load, save } from "./store";
import { dateSchema } from "../src/lib/schema";
// Explicit date takes priority. EXIF local wall-clock components avoid timezone date shifts.
function exifString(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
async function main() {
  const args = process.argv.slice(2);
  const file = args[0];
  const option = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (!file)
    throw new Error(
      "用法：npm run photos -- 图片路径 --date YYYY-MM-DD --id 唯一英文名 --title 标题 [--description 描述]",
    );
  const id = option("id");
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id))
    throw new Error("请提供只含英文、数字、下划线或短横线的唯一 --id");
  const buffer = await readFile(resolve(file));
  const exif = await exifr
    .parse(buffer, ["DateTimeOriginal"])
    .catch(() => null);
  const capturedAt =
    exif?.DateTimeOriginal instanceof Date
      ? exifString(exif.DateTimeOriginal)
      : null;
  const date = option("date") ?? capturedAt?.slice(0, 10);
  if (!date)
    throw new Error("无拍摄日期 EXIF，请明确提供 --date，不猜测拍摄日期。");
  dateSchema.parse(date);
  const title = option("title");
  if (!title) throw new Error("请提供 --title");
  const data = await load();
  if (data.photos.some((p) => p.id === id))
    throw new Error(
      "照片 ID 已存在；请用新的 ID 或通过 data upsert 修改文字。",
    );
  const folder = `photos/${date.slice(0, 7)}`;
  const src = `${folder}/${id}.webp`,
    thumbnail = `${folder}/${id}-thumb.webp`;
  const paths = [src, thumbnail].map((p) => resolve(root, "public", p));
  await mkdir(resolve(root, "public", folder), { recursive: true });
  for (const p of paths) {
    try {
      await access(p);
      throw new Error(`文件已存在：${p}`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  let originalWritten = false,
    thumbnailWritten = false;
  try {
    await sharp(buffer)
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toFile(paths[0]);
    originalWritten = true;
    await sharp(buffer)
      .rotate()
      .resize({
        width: 800,
        height: 800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toFile(paths[1]);
    thumbnailWritten = true;
    await save("photos", [
      ...data.photos,
      {
        id,
        date,
        src,
        thumbnail,
        title,
        description: option("description") ?? "",
        notes: "",
        capturedAt,
      },
    ]);
  } catch (e) {
    if (originalWritten) await unlink(paths[0]);
    if (thumbnailWritten) await unlink(paths[1]);
    throw e;
  }
  console.log(
    `已导入 ${src} 与缩略图；未裁剪主体，拍摄日期信息写入照片索引。请另行保留相机原图。`,
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
