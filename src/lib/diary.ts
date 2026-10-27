import type { DiaryData, Profile } from "./schema";
export function today() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export const stamp = (s: string) => Date.parse(`${s}T00:00:00Z`);
export const shortDate = (s: string) =>
  `${Number(s.slice(5, 7))}月${Number(s.slice(8, 10))}日`;
export const fullDate = (s: string) => s.replaceAll("-", ".");
export function birthLabel(p: Profile) {
  return p.birthDate
    ? fullDate(p.birthDate)
    : p.estimatedBirthMonth
      ? `约 ${p.estimatedBirthMonth.slice(0, 4)} 年 ${Number(p.estimatedBirthMonth.slice(5))} 月`
      : "待记录";
}
export function ageLabel(p: Profile, now = today()) {
  const birth =
    p.birthDate ??
    (p.estimatedBirthMonth ? `${p.estimatedBirthMonth}-01` : null);
  if (!birth || birth > now) return "待记录";
  const b = new Date(birth),
    n = new Date(`${now}T00:00:00Z`);
  let months =
    (n.getUTCFullYear() - b.getUTCFullYear()) * 12 +
    n.getUTCMonth() -
    b.getUTCMonth();
  if (p.birthDate && n.getUTCDate() < b.getUTCDate()) months--;
  const prefix = p.birthDate ? "" : "约 ";
  return (
    prefix +
    (months >= 12
      ? `${Math.floor(months / 12)} 岁${months % 12 ? ` ${months % 12} 个月` : ""}`
      : months > 0
        ? `${months} 个月`
        : `${Math.floor((stamp(now) - stamp(birth)) / 86400000)} 天`)
  );
}
export const companionDays = (p: Profile, now = today()) =>
  p.arrivalDate && p.arrivalDate <= now
    ? Math.floor((stamp(now) - stamp(p.arrivalDate)) / 86400000) + 1
    : null;
export const chronological = <T extends { date: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.date.localeCompare(b.date));
export function weightStats(data: DiaryData, now = today()) {
  const rows = chronological(data.weights.filter((r) => r.date <= now));
  const latest = rows.at(-1);
  const previous = rows.at(-2);
  return {
    rows,
    latest,
    max: rows.length ? Math.max(...rows.map((r) => r.grams)) : null,
    change:
      latest && previous
        ? Math.round((latest.grams - previous.grams) * 100) / 100
        : null,
  };
}
export function activities(data: DiaryData, now = today()) {
  return [
    ...data.weights.map((r) => ({
      id: r.id,
      date: r.date,
      title: `记录了一次体重 · ${r.grams} g`,
      description: r.notes,
      kind: "weight",
    })),
    ...data.feedings.map((r) => ({
      id: r.id,
      date: r.date,
      title: `喂食 · ${r.food}`,
      description: r.notes,
      kind: "feeding",
    })),
    ...data.shedding.map((r) => ({
      id: r.id,
      date: r.date,
      title: r.kind === "shedding" ? "一次小小的蜕变" : "健康观察",
      description: r.notes,
      kind: "health",
    })),
    ...data.photos.map((r) => ({
      id: r.id,
      date: r.date,
      title: r.title,
      description: r.description,
      kind: "photo",
    })),
    ...data.milestones.map((r) => ({ ...r, kind: "milestone" })),
    ...(data.profile.arrivalDate
      ? [
          {
            id: "arrival",
            date: data.profile.arrivalDate,
            title: "欢迎回家，王豹豹",
            description: "我们的故事，从这一天开始。",
            kind: "milestone",
          },
        ]
      : []),
  ]
    .filter((r) => r.date <= now)
    .sort((a, b) => b.date.localeCompare(a.date));
}
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = [...new Set(rows.flatMap(Object.keys))];
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return `"${s.replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      keys.map(cell).join(","),
      ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
    ].join("\r\n")
  );
}
