# BaoBao's Growth Diary · 王豹豹的成长手账

React + TypeScript + Vite + Tailwind CSS + Recharts + Lucide + Framer Motion。无需后端。正式数据随 Git 仓库版本管理，不使用 localStorage。

## 启动与检查

推荐 Node.js 24。首次执行 `npm ci`，然后 `npm run dev`。开发地址包含 `/wang-baobao/`。

```sh
npm test
npm run build
npm run preview
```

`build` 自动检查数据、照片文件及 TypeScript。浏览器使用 hash 导航，直接刷新 `/#album` 等地址仍能打开。所有静态资源通过 Vite BASE_URL 拼接。

## 目录

```text
src/
  App.tsx                  各页面与导航
  components/              公用卡片、插画、弹窗、交互图表
  lib/schema.ts            Zod 运行时校验与推导出的 TypeScript 类型
  lib/diary.ts             年龄、陪伴天数、统计、导出逻辑
  data/                    正式 JSON 数据
public/photos/YYYY-MM/     高清网页图与缩略图
scripts/                   数据增删改、校验、导出与照片导入
tests/                     数据真实性边界及日期/导出测试
.github/workflows/         main 自动构建与 GitHub Pages 部署
```

## 当前真实数据

姓名王豹豹 / BaoBao；估计出生月为 2026-08，未指定某一天，年龄按月份近似计算并显示“约”。可在确认后填写 birthDate，优先使用确切生日。性别 unknown、品系 morph 为 null、到家日期 arrivalDate 为 null。10 g 为主人提供，日期暂按提供当日 2026-10-27 记录，若实际称重日期不同请修正。其他集合为空，插画只作占位。

## 以后交给 Codex 的更新指令

“请更新 jianingwang672-dot/wang-baobao：2026-11-03 体重 XX g，备注……；附图拍摄于 2026-11-03，标题……。导入照片，执行校验/测试/构建，提交推送并验证部署。”

不确定的信息应保留 null 或留空。不要根据图片猜品系或性别。里程碑只添加已经发生的事件。网页仅显示截至中国时区当天的记录，未来日期不会被当作完成事件。

## 数据结构与更新

每条记录都有唯一 id、ISO 日期 `YYYY-MM-DD` 与 notes。其他字段参见 `src/lib/schema.ts`（严格校验，不接受拼错或额外字段）。未知字段用 null 或空字符串，遵从各字段类型。

集合字段：

| 文件            | 字段（除 id/date/notes）                                                         |
| --------------- | -------------------------------------------------------------------------------- |
| weights.json    | grams：正数，单位 g                                                              |
| feedings.json   | food，quantity：非负整数或 null，unit，normal：布尔或 null，supplements          |
| shedding.json   | kind：shedding / observation，complete 与 retainedSkin：布尔或 null，mood，stool |
| milestones.json | title，description                                                               |
| photos.json     | src，thumbnail，title，description，capturedAt：EXIF 时间或 null                 |

将单条或数组记录保存到仓库外的输入 JSON 文件。所有维护命令都在项目根目录运行：

```sh
npm run data -- add weights /path/new-weight.json
npm run data -- upsert weights /path/corrected-weight.json
npm run data -- delete weights weight-record-id
npm run data -- replace feedings /path/full-feedings.json
npm run data -- profile /path/profile.json
npm run data -- validate
npm run data -- export
```

称重 JSON 格式（将日期和克数替换为真实记录）：`{"id":"唯一ID","date":"YYYY-MM-DD","grams":实际数字,"notes":""}`。修改记录必须保留 ID。`add` 拒绝覆盖；`upsert` 可新增/修改；`replace` 以完整集合替换；`delete` 删除记录。修改和删除均纳入 Git 历史，可恢复。封面可用 profile.coverPhotoId 指向真实照片 ID；null 时首页展示最新照片。删除封面照片前请先取消 coverPhotoId。

## 照片管理

```sh
npm run photos -- /path/to/photo.jpg --date 2026-11-03 --id baobao-20261103-01 --title "真实照片标题" --description "拍摄描述"
```

导入会自动旋转方向、保持完整画幅、压缩为最长边 2400px 的 WebP（质量 90），并生成最长边 800px 的缩略图（质量 82）；小图不放大。按 `public/photos/YYYY-MM/` 保存并写入 photos.json。不裁剪身体。EXIF 原始拍摄时间写入 capturedAt，显式 --date 优先；没有 EXIF 就必须提供日期。导出的图片移除 GPS 等元数据，拍摄日期保存在索引中。保留相机原图的独立备份，网页压缩图不是无损原图。

删除照片先用 `data delete photos ID` 删除索引，文件暂留以避免误删。确认已有备份后可手动删掉对应 WebP 和 thumb 文件。文字修改用 `upsert photos`，必须包含完整记录。

## 备份

网页“记录与备份”支持完整 JSON 和各集合 CSV。CLI `export` 输出到 exports/当天日期/。CSV 防止备注被表格软件当公式执行。空集合的 CSV 为空文件。JSON 不包含照片二进制内容；请下载完整 GitHub 仓库（含 public/photos）作为整站备份。无需在浏览器填写后手动同步，不存在未发布浏览器草稿。

## GitHub Pages

目标仓库：https://github.com/jianingwang672-dot/wang-baobao

预期网址：https://jianingwang672-dot.github.io/wang-baobao/

Vite base 已固定为 `/wang-baobao/`。仓库 Settings → Pages → Source 选择 GitHub Actions。推送 main 后 workflow 依次运行 npm ci、测试、数据校验、TypeScript 检查、生产构建和 Pages 部署。检查 Actions 的绿色结果后再访问网址。网址内容应与该次提交一致，只有访问与资源检查通过才算完成。

## 界面维护

自适应浅色手账布局；中文系统字体与衬线字体搭配，无外部字体依赖。导航使用 hash，图表按实际日期比例排列并支持触摸提示。相册懒加载且完整显示图片，弹窗使用原生 dialog 保留焦点约束与 Escape 关闭能力。动画尊重系统 reduced-motion 设置。
