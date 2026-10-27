import { useEffect, useState, lazy, Suspense } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  ChartNoAxesCombined,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  House,
  Leaf,
  BookOpen,
  Scale,
  Sparkles,
  Utensils,
  CalendarDays,
  GitBranch,
  Images,
  Menu,
  X,
  ArrowLeftRight,
  ExternalLink,
} from "lucide-react";
import { data } from "./lib/data";
import {
  ageLabel,
  birthLabel,
  companionDays,
  weightStats,
  activities,
  fullDate,
  today,
  shortDate,
  csv,
  chronological,
} from "./lib/diary";
import {
  Empty,
  SectionTitle,
  LinkButton,
  PhotoImage,
  PhotoPlaceholder,
  Modal,
} from "./components/Shared";
import Gecko from "./components/Gecko";
import type { Collection } from "./lib/schema";
const WeightChart = lazy(() => import("./components/WeightChart"));
const navigation = [
  { id: "home", label: "豹豹的小窝", icon: House },
  { id: "album", label: "成长相册", icon: Camera },
  { id: "weight", label: "体重曲线", icon: ChartNoAxesCombined },
  { id: "feeding", label: "喂食手账", icon: Utensils },
  { id: "health", label: "蜕皮与健康", icon: Leaf },
  { id: "timeline", label: "成长时间线", icon: BookOpen },
];
const publishedPhotos = chronological(
  data.photos.filter((p) => p.date <= today()),
).reverse();
const boolLabel = (v: boolean | null) =>
  v === null ? "待记录" : v ? "是" : "否";
function WeightPanel({ compact = false }: { compact?: boolean }) {
  return (
    <Suspense fallback={<div className="empty">正在展开成长曲线…</div>}>
      <WeightChart compact={compact} />
    </Suspense>
  );
}
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Dashboard() {
  const { profile } = data;
  const stats = weightStats(data);
  const days = companionDays(profile);
  const latestPhoto =
    publishedPhotos.find((p) => p.id === profile.coverPhotoId) ??
    publishedPhotos[0];
  const feed = chronological(data.feedings.filter((r) => r.date <= today())).at(
    -1,
  );
  const shed = chronological(
    data.shedding.filter((r) => r.date <= today() && r.kind === "shedding"),
  ).at(-1);
  return (
    <>
      <div className="welcome-line">
        <span>
          <i /> 一只小守宫的慢慢长大
        </span>
        <span>
          {fullDate(today())}{" "}
          <span className="desktop-only"> / LIFE, LITTLE BY LITTLE</span>
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-line" /> BAOBAO'S GROWTH DIARY
          </span>
          <h1>
            小小豹豹，
            <br />
            慢慢<span className="handwritten">长大</span>
            <span className="hero-star">✳</span>
          </h1>
          <p>
            把每一克成长、每一次蜕变，
            <br />
            和那些平凡又珍贵的小瞬间，好好收藏。
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#album">
              翻开成长相册
              <ArrowUpRight size={17} />
            </a>
            <a className="subtle-button" href="#timeline">
              我们的故事
              <ArrowRight size={16} />
            </a>
          </div>
          <div className="hero-signature">
            <Heart size={14} /> 一份会陪伴很多年的小小档案
          </div>
        </div>
        <div className="hero-photo">
          <div className="photo-tape" />
          {latestPhoto ? (
            <div className="cover-real">
              <PhotoImage photo={latestPhoto} />
            </div>
          ) : (
            <PhotoPlaceholder large />
          )}
          <div className="photo-caption">
            <span>
              hello, i'm <em>BaoBao</em>
            </span>
            <span>
              王豹豹 <Heart size={14} />
            </span>
          </div>
          <div className="photo-badge">
            <Sparkles size={15} /> {ageLabel(profile)}的小生命
          </div>
        </div>
      </section>
      <section className="profile-strip" aria-label="王豹豹的基本信息">
        <div className="profile-name">
          <div className="mini-gecko">
            <Gecko />
          </div>
          <div>
            <h2>
              {profile.name}
              <span>{profile.englishName}</span>
            </h2>
            <p>
              {profile.species} · {profile.speciesEnglish}
            </p>
          </div>
        </div>
        <dl>
          <div>
            <dt>出生</dt>
            <dd>{birthLabel(profile)}</dd>
          </div>
          <div>
            <dt>性别 / 品系</dt>
            <dd>
              {profile.sex === "unknown"
                ? "未知"
                : profile.sex === "male"
                  ? "雄性"
                  : "雌性"}{" "}
              / {profile.morph ?? "未知"}
            </dd>
          </div>
          <div>
            <dt>体色</dt>
            <dd>{profile.appearance}</dd>
          </div>
        </dl>
      </section>
      <div className="stats-grid">
        <Stat
          icon={<Heart />}
          label="一起度过"
          value={days === null ? "待记录" : String(days)}
          unit={days === null ? "" : "天"}
          detail={
            profile.arrivalDate
              ? `到家于 ${fullDate(profile.arrivalDate)}`
              : "填下到家日期，开启陪伴计时"
          }
          color="rose"
        />
        <Stat
          icon={<Scale />}
          label="最新体重"
          value={stats.latest ? String(stats.latest.grams) : "待记录"}
          unit={stats.latest ? "g" : ""}
          detail={
            stats.change === null
              ? "待下次称重，记录新的变化"
              : `较上次 ${stats.change > 0 ? "+" : ""}${stats.change} g`
          }
          color="peach"
        />
        <Stat
          icon={<Leaf />}
          label="最近蜕皮"
          value={shed ? shortDate(shed.date) : "待记录"}
          detail={
            shed
              ? `${shed.date.slice(0, 4)} 年 · ${shed.complete === null ? "完整情况待记录" : shed.complete ? "完整蜕皮" : "有待观察"}`
              : "每次蜕变，都值得被记住"
          }
          color="sage"
        />
        <Stat
          icon={<Utensils />}
          label="最近喂食"
          value={feed ? shortDate(feed.date) : "待记录"}
          detail={
            feed
              ? `${feed.food} · ${feed.quantity ?? "待记录"}${feed.unit}`
              : "认真记录每一顿小小的满足"
          }
          color="sand"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <SectionTitle
            eyebrow="A LITTLE HEAVIER"
            title="每一克，都是成长"
            action={<LinkButton to="weight">完整记录</LinkButton>}
          />
          <WeightPanel compact />
        </section>
        <section className="panel recent-panel">
          <SectionTitle
            eyebrow="LITTLE MOMENTS"
            title="最近的小事"
            action={<LinkButton to="timeline">全部</LinkButton>}
          />
          <ActivityList limit={3} />
          <div className="note-card">
            <span>Dear BaoBao,</span>
            <p>不用着急，按你的节奏长大就好。</p>
            <Heart size={18} />
          </div>
        </section>
      </div>
      <section className="album-preview">
        <SectionTitle
          eyebrow="COLLECTING MEMORIES"
          title="把可爱，存进时光里"
          description="每个月一张照片，很多年后，就是一部成长电影。"
          action={<LinkButton to="album">查看相册</LinkButton>}
        />
        {publishedPhotos.length ? (
          <div className="photo-grid">
            {publishedPhotos.slice(0, 3).map((p) => (
              <a className="photo-card" href="#album" key={p.id}>
                <div className="photo-media">
                  <PhotoImage photo={p} thumbnail />
                </div>
                <div className="photo-meta">
                  <span>{p.title}</span>
                  <small>{fullDate(p.date)}</small>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <a className="album-empty-banner" href="#album">
            <div className="outline-camera">
              <Camera size={30} />
            </div>
            <div>
              <h3>第一张照片的位置，已经留好啦</h3>
              <p>等你带来王豹豹的真实照片，这本相册就正式开始了。</p>
            </div>
            <ArrowUpRight />
          </a>
        )}
      </section>
    </>
  );
}
function Stat({
  icon,
  label,
  value,
  unit,
  detail,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  detail: string;
  color: string;
}) {
  return (
    <article className={`stat ${color}`}>
      <div className="stat-label">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`stat-value ${value === "待记录" ? "unrecorded" : ""}`}>
        {value}
        <small>{unit}</small>
      </div>
      <p>{detail}</p>
    </article>
  );
}
function Album() {
  const [month, setMonth] = useState("all");
  const [active, setActive] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [left, setLeft] = useState(publishedPhotos.at(-1)?.id ?? "");
  const [right, setRight] = useState(publishedPhotos[0]?.id ?? "");
  const months = [...new Set(publishedPhotos.map((p) => p.date.slice(0, 7)))];
  const filtered = publishedPhotos.filter(
    (p) => month === "all" || p.date.startsWith(month),
  );
  const photo = publishedPhotos.find((p) => p.id === active);
  const step = (delta: number) => {
    const idx = publishedPhotos.findIndex((p) => p.id === active);
    setActive(
      publishedPhotos[
        (idx + delta + publishedPhotos.length) % publishedPhotos.length
      ].id,
    );
  };
  return (
    <>
      <PageHeading
        eyebrow="THE GROWING ALBUM"
        title="时光里的王豹豹"
        description="从小小一只，到慢慢长大。每张照片，都是一个值得收藏的日子。"
      />
      <div className="page-toolbar">
        <div className="filter-chips">
          <button
            aria-pressed={month === "all"}
            onClick={() => setMonth("all")}
          >
            全部照片 <small>{publishedPhotos.length}</small>
          </button>
          {months.map((m) => (
            <button
              key={m}
              aria-pressed={month === m}
              onClick={() => setMonth(m)}
            >
              {m.replace("-", " 年 ")} 月
            </button>
          ))}
        </div>
        <button className="outline-button" onClick={() => setCompare(true)}>
          <ArrowLeftRight size={16} /> 成长对比
        </button>
      </div>
      {filtered.length ? (
        <div className="photo-grid">
          {filtered.map((p) => (
            <button
              className="photo-card"
              key={p.id}
              onClick={() => setActive(p.id)}
            >
              <div className="photo-media">
                <PhotoImage photo={p} thumbnail />
                <span className="photo-open">
                  放大查看 <ArrowUpRight size={15} />
                </span>
              </div>
              <div className="photo-meta">
                <strong>{p.title}</strong>
                <small>{fullDate(p.date)}</small>
                <p>{p.description}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="panel album-empty">
          <PhotoPlaceholder />
          <h3>故事的第一张照片，等你来放</h3>
          <p>
            把真实照片交给 Codex，便能按月份收进这里。
            <br />
            照片会与网站一起保存在 GitHub 仓库中。
          </p>
          <a className="text-link" href="#manage">
            查看照片添加方式
            <ArrowRight size={16} />
          </a>
        </div>
      )}
      {photo && (
        <Modal label="照片详情" onClose={() => setActive(null)}>
          <div className="lightbox-media">
            <PhotoImage photo={photo} />
          </div>
          <div className="lightbox-caption">
            <div>
              <span className="eyebrow">{fullDate(photo.date)}</span>
              <h2>{photo.title}</h2>
              <p>{photo.description}</p>
            </div>
            <div className="lightbox-arrows">
              <button
                className="icon-button"
                aria-label="上一张照片"
                onClick={() => step(-1)}
              >
                <ChevronLeft />
              </button>
              <button
                className="icon-button"
                aria-label="下一张照片"
                onClick={() => step(1)}
              >
                <ChevronRight />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {compare && (
        <Modal label="成长对比" onClose={() => setCompare(false)}>
          <SectionTitle
            eyebrow="SIDE BY SIDE"
            title="原来，你长大了这么多"
            description="选择两个不同日期的照片，看看时光留下的变化。"
          />
          {publishedPhotos.length < 2 ? (
            <Empty title="再收藏一张，就能对比啦">
              成长对比需要至少两个不同日期的真实照片。
            </Empty>
          ) : (
            <>
              <div className="compare-grid">
                {[
                  ["较早的瞬间", left, setLeft],
                  ["后来的模样", right, setRight],
                ].map(([label, id, setter]) => {
                  const p = publishedPhotos.find((p) => p.id === id);
                  return (
                    <div key={label as string}>
                      <label>
                        {label as string}
                        <select
                          value={id as string}
                          onChange={(e) =>
                            (setter as (s: string) => void)(e.target.value)
                          }
                        >
                          {publishedPhotos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {fullDate(p.date)} · {p.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="compare-photo">
                        {p && <PhotoImage photo={p} />}
                      </div>
                    </div>
                  );
                })}
              </div>
              {publishedPhotos.find((p) => p.id === left)?.date ===
              publishedPhotos.find((p) => p.id === right)?.date ? (
                <p className="inline-notice">请选择两个不同日期的照片。</p>
              ) : (
                <p className="chart-note">
                  完整显示照片，保留身体与尾巴的每一处变化。
                </p>
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
function WeightPage() {
  const stats = weightStats(data);
  return (
    <>
      <PageHeading
        eyebrow="EVERY GRAM COUNTS"
        title="一克一克，慢慢长大"
        description="只记录豹豹自己的成长节奏。没有标准曲线，每一次真实称重都很珍贵。"
      />
      <div className="weight-stats">
        <Stat
          icon={<Scale />}
          label="最新体重"
          value={stats.latest ? String(stats.latest.grams) : "待记录"}
          unit={stats.latest ? "g" : ""}
          detail={stats.latest ? fullDate(stats.latest.date) : "等待第一次称重"}
          color="peach"
        />
        <Stat
          icon={<ChartNoAxesCombined />}
          label="历史最大体重"
          value={stats.max === null ? "待记录" : String(stats.max)}
          unit={stats.max === null ? "" : "g"}
          detail={`已记录 ${stats.rows.length} 次称重`}
          color="sand"
        />
        <Stat
          icon={<ArrowUpRight />}
          label="最近一次变化"
          value={
            stats.change === null
              ? "待下次称重"
              : `${stats.change > 0 ? "+" : ""}${stats.change}`
          }
          unit={stats.change === null ? "" : "g"}
          detail={
            stats.change === null
              ? "至少两次称重后计算"
              : "与前一次实际称重相比"
          }
          color="sage"
        />
      </div>
      <section className="panel">
        <SectionTitle eyebrow="GROWTH CURVE" title="豹豹的成长曲线" />
        <WeightPanel />
      </section>
      <section className="panel mt">
        <SectionTitle
          eyebrow="WEIGH-IN JOURNAL"
          title="每一次称重"
          action={
            <button
              className="text-link"
              onClick={() =>
                download(
                  "baobao-weights.csv",
                  csv(data.weights),
                  "text/csv;charset=utf-8",
                )
              }
            >
              <Download size={16} />
              导出 CSV
            </button>
          }
        />
        {stats.rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>日期</th>
                  <th>体重</th>
                  <th>较上次</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                {[...stats.rows].reverse().map((r) => {
                  const i = stats.rows.findIndex((p) => p.id === r.id);
                  return (
                    <tr key={r.id}>
                      <td>{fullDate(r.date)}</td>
                      <td className="weight-cell">
                        {r.grams} <small>g</small>
                      </td>
                      <td>
                        {i
                          ? `${Math.round((r.grams - stats.rows[i - 1].grams) * 100) / 100} g`
                          : "首次记录"}
                      </td>
                      <td className="muted">{r.notes || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="等待第一枚成长坐标" icon="sprout">
            真实体重添加后会自动显示在这里。
          </Empty>
        )}
      </section>
    </>
  );
}
function FeedingPage() {
  const [month, setMonth] = useState("all");
  const rows = chronological(
    data.feedings.filter((r) => r.date <= today()),
  ).reverse();
  const filtered = rows.filter(
    (r) => month === "all" || r.date.startsWith(month),
  );
  return (
    <>
      <PageHeading
        eyebrow="LITTLE BITES, HAPPY DAYS"
        title="今天，也有好好吃饭"
        description="记下每一顿小小的满足，也留意食欲细微的变化。"
      />
      <div className="summary-ribbon">
        <span>
          <Utensils size={18} /> 共 <strong>{filtered.length}</strong> 次喂食
        </span>
        <span>
          正常进食{" "}
          <strong>{filtered.filter((r) => r.normal === true).length}</strong> 次
        </span>
        <span>
          食物种类 <strong>{new Set(filtered.map((r) => r.food)).size}</strong>{" "}
          种
        </span>
      </div>
      <div className="panel">
        <div className="records-heading">
          <h3>喂食记录</h3>
          <MonthFilter rows={rows} value={month} onChange={setMonth} />
        </div>
        {filtered.length ? (
          <div className="record-list">
            {filtered.map((r) => (
              <article className="feeding-record" key={r.id}>
                <div className="record-date">
                  <CalendarDays size={17} />
                  {fullDate(r.date)}
                </div>
                <h3>
                  {r.food}
                  <span>
                    {r.quantity ?? "待记录"} {r.unit}
                  </span>
                </h3>
                <div className="record-pills">
                  <span>正常进食：{boolLabel(r.normal)}</span>
                  <span>补充：{r.supplements || "待记录"}</span>
                </div>
                <p>{r.notes || "暂无备注"}</p>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="下一顿小满足，从这里记起" icon="sprout">
            目前没有喂食记录。日期、食物、数量与补充情况，都会好好留下。
          </Empty>
        )}
      </div>
    </>
  );
}
function HealthPage() {
  const rows = chronological(
    data.shedding.filter((r) => r.date <= today()),
  ).reverse();
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE CARE, EVERY DAY"
        title="每一次蜕变，都被看见"
        description="温柔观察，认真记录。收好每次蜕皮与日常状态的小线索。"
      />
      <div className="panel">
        {rows.length ? (
          <div className="health-timeline">
            {rows.map((r) => (
              <article key={r.id}>
                <div className="timeline-dot">
                  <Leaf size={16} />
                </div>
                <div className="eyebrow">{fullDate(r.date)}</div>
                <h3>{r.kind === "shedding" ? "蜕皮记录" : "日常健康观察"}</h3>
                <dl className="health-details">
                  {r.kind === "shedding" && (
                    <>
                      <div>
                        <dt>完整蜕皮</dt>
                        <dd>{boolLabel(r.complete)}</dd>
                      </div>
                      <div>
                        <dt>残留皮</dt>
                        <dd>{boolLabel(r.retainedSkin)}</dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt>精神状态</dt>
                    <dd>{r.mood || "待记录"}</dd>
                  </div>
                  <div>
                    <dt>排便情况</dt>
                    <dd>{r.stool || "待记录"}</dd>
                  </div>
                </dl>
                <p>{r.notes}</p>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="细小的变化，也值得认真对待" icon="sprout">
            这里将记录蜕皮、精神状态、排便情况与其他健康观察。
          </Empty>
        )}
      </div>
      <div className="soft-note">
        <Leaf size={19} />
        <p>这是一份观察手账。出现持续异常时，请咨询有爬宠经验的兽医。</p>
      </div>
    </>
  );
}
function ActivityList({ limit }: { limit?: number }) {
  const rows = activities(data).slice(0, limit);
  return rows.length ? (
    <div className="activity-list">
      {rows.map((r, i) => (
        <article key={`${r.kind}-${r.id}`}>
          <span className="activity-dot">
            {r.kind === "weight" ? (
              <Scale size={15} />
            ) : r.kind === "photo" ? (
              <Camera size={15} />
            ) : (
              <Heart size={15} />
            )}
          </span>
          <div>
            <time>{fullDate(r.date)}</time>
            <h3>{r.title}</h3>
            {!limit && r.description && <p>{r.description}</p>}
            {i === 0 && <small className="latest-tag">最新记录</small>}
          </div>
        </article>
      ))}
    </div>
  ) : (
    <Empty title="故事会慢慢写满" icon="sprout">
      重要的小日子，发生之后再记下来。
    </Empty>
  );
}
function Timeline() {
  return (
    <>
      <PageHeading
        eyebrow="OUR LITTLE STORY"
        title="日子慢慢，故事长长"
        description="从一次称重到一个重要时刻。只收藏已经发生的，等待未来的惊喜。"
      />
      <div className="panel timeline-panel">
        <ActivityList />
      </div>
      <div className="future-note">
        <Sparkles size={22} />
        <p>
          未来还有很多第一次。
          <br />
          <span>不提前打勾，留给真实发生的那一天。</span>
        </p>
      </div>
    </>
  );
}
function MonthFilter({
  rows,
  value,
  onChange,
}: {
  rows: { date: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="month-select">
      月份
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">全部月份</option>
        {[...new Set(rows.map((r) => r.date.slice(0, 7)))].map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </label>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>
        {title}
        <span className="title-dot">.</span>
      </h1>
      <p>{description}</p>
    </header>
  );
}
function Manage() {
  const [collection, setCollection] = useState<Collection>("weights");
  const [exported, setExported] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="KEEPING MEMORIES SAFE"
        title="让记录，陪伴很多年"
        description="正式数据保存在 GitHub 仓库中。更新、备份和迁移，都简单可靠。"
      />
      <div className="manage-grid">
        <section className="panel">
          <div className="manage-icon">
            <GitBranch />
          </div>
          <h2>用仓库保存每一份成长</h2>
          <p>
            本网站展示的是已发布的 JSON
            记录与静态照片。网页不直接修改数据，也不使用浏览器本地存储保存正式记录。
          </p>
          <ol className="steps">
            <li>
              <strong>把新记录或照片发给 Codex</strong>
              <p>说明日期、体重或照片描述；不确定的信息可以留空。</p>
            </li>
            <li>
              <strong>更新 JSON / 导入照片</strong>
              <p>维护工具校验日期、格式、照片路径与重复 ID。</p>
            </li>
            <li>
              <strong>检查并推送到 main</strong>
              <p>GitHub Actions 构建并自动发布，所有设备看到同一份记录。</p>
            </li>
          </ol>
          <a
            className="outline-button"
            href="https://github.com/jianingwang672-dot/wang-baobao"
            target="_blank"
            rel="noreferrer"
          >
            打开 GitHub 仓库
            <ExternalLink size={15} />
          </a>
        </section>
        <section className="panel">
          <div className="manage-icon">
            <Download />
          </div>
          <h2>给时光，多留一份备份</h2>
          <p>
            JSON 包含全部结构化数据。CSV 适合用表格查看。照片文件需另外从 GitHub
            下载备份。
          </p>
          <button
            className="primary-button full"
            onClick={() => {
              download(
                `baobao-backup-${today()}.json`,
                JSON.stringify(data, null, 2),
                "application/json",
              );
              setExported("全部 JSON 数据已导出");
            }}
          >
            <Download size={16} />
            导出完整 JSON 数据
          </button>
          <label className="export-label">
            选择 CSV 记录
            <select
              value={collection}
              onChange={(e) => setCollection(e.target.value as Collection)}
            >
              {Object.entries({
                weights: "体重",
                feedings: "喂食",
                shedding: "蜕皮与健康",
                milestones: "里程碑",
                photos: "照片索引",
              }).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <button
            className="outline-button full"
            onClick={() => {
              download(
                `baobao-${collection}-${today()}.csv`,
                csv(data[collection]),
                "text/csv;charset=utf-8",
              );
              setExported("CSV 已导出；空集合会导出空文件");
            }}
          >
            <Download size={16} />
            导出所选 CSV
          </button>
          <p className="export-status" role="status">
            {exported && (
              <>
                <Check size={15} />
                {exported}
              </>
            )}
          </p>
          <div className="backup-note">
            <Heart size={16} />
            <p>Git 历史也会保存每次修改。每一条成长记录，都有迹可循。</p>
          </div>
        </section>
      </div>
    </>
  );
}
export default function App() {
  const readRoute = () => {
    const route = window.location.hash.slice(1);
    return [...navigation.map((n) => n.id), "manage"].includes(route)
      ? route
      : "home";
  };
  const [page, setPage] = useState(readRoute);
  const [menu, setMenu] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => {
    const onHash = () => {
      setPage(readRoute());
      setMenu(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    document.title = `${navigation.find((n) => n.id === page)?.label ?? "数据与备份"} · 王豹豹 BaoBao`;
  }, [page]);
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        跳到主要内容
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#home" aria-label="BaoBao 首页">
            <span className="brand-symbol">
              <Gecko />
            </span>
            <span>
              BaoBao<span className="brand-period">.</span>
              <small>王豹豹的成长手账</small>
            </span>
          </a>
          <nav className={menu ? "open" : ""} aria-label="主导航">
            {navigation.map((n) => (
              <a
                href={`#${n.id}`}
                key={n.id}
                aria-current={page === n.id ? "page" : undefined}
              >
                <n.icon size={15} />
                {n.label}
              </a>
            ))}
          </nav>
          <a
            className={`header-save ${page === "manage" ? "active" : ""}`}
            href="#manage"
            aria-label="数据维护与备份"
          >
            <Download size={17} />
            <span>记录与备份</span>
          </a>
          <button
            className="mobile-menu icon-button"
            aria-expanded={menu}
            aria-label={menu ? "关闭导航" : "打开导航"}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main-content" className="main-wrap" tabIndex={-1}>
        <motion.div
          key={page}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {page === "home" ? (
            <Dashboard />
          ) : page === "album" ? (
            <Album />
          ) : page === "weight" ? (
            <WeightPage />
          ) : page === "feeding" ? (
            <FeedingPage />
          ) : page === "health" ? (
            <HealthPage />
          ) : page === "timeline" ? (
            <Timeline />
          ) : (
            <Manage />
          )}
        </motion.div>
      </main>
      <footer>
        <div className="footer-inner">
          <div>
            <span className="footer-brand">
              BaoBao<span>.</span>
            </span>
            <p>小小的你，值得被好好记录。</p>
          </div>
          <div className="footer-right">
            <span>
              MADE WITH <Heart size={12} /> & A LITTLE PEACH
            </span>
            <p>
              王豹豹的成长手账 · 始于 2026{" "}
              <a href="#manage">
                数据与备份
                <ArrowUpRight size={12} />
              </a>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
