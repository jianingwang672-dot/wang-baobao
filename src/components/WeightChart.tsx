import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useDiary } from "../lib/DiaryContext";
import { weightStats, today, stamp, shortDate, fullDate } from "../lib/diary";
import { Empty } from "./Shared";
export default function WeightChart({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [range, setRange] = useState("all");
  const { data } = useDiary();
  const stats = weightStats(data);
  const cutoff =
    range === "all" ? 0 : stamp(today()) - (Number(range) - 1) * 86400000;
  const points = stats.rows
    .filter((r) => stamp(r.date) >= cutoff)
    .map((r) => ({ ...r, time: stamp(r.date) }));
  return (
    <>
      <div className="chart-toolbar">
        <span className="chart-legend">
          <i />
          体重 <small>g</small>
        </span>
        <div className="segmented" aria-label="体重日期范围">
          {[
            ["30", "30 天"],
            ["90", "90 天"],
            ["all", "全部"],
          ].map(([v, label]) => (
            <button
              key={v}
              aria-pressed={range === v}
              onClick={() => setRange(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {points.length ? (
        <>
          <div
            className={`chart ${compact ? "compact" : ""}`}
            role="img"
            aria-label={`体重记录，共 ${points.length} 次；最新 ${points.at(-1)?.grams} 克`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={points}
                margin={{ top: 20, right: 20, left: -26, bottom: 8 }}
                accessibilityLayer
              >
                <CartesianGrid
                  stroke="#ede7de"
                  strokeDasharray="3 5"
                  vertical={false}
                />
                <XAxis
                  type="number"
                  dataKey="time"
                  scale="time"
                  domain={
                    points.length === 1
                      ? [points[0].time - 86400000, points[0].time + 86400000]
                      : ["dataMin", "dataMax"]
                  }
                  ticks={points.length === 1 ? [points[0].time] : undefined}
                  tickFormatter={(v) =>
                    shortDate(new Date(v).toISOString().slice(0, 10))
                  }
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#92877d", fontSize: 11 }}
                  minTickGap={30}
                />
                <YAxis
                  domain={[0, "auto"]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#92877d", fontSize: 11 }}
                />
                <Tooltip
                  labelFormatter={(v) =>
                    fullDate(new Date(Number(v)).toISOString().slice(0, 10))
                  }
                  formatter={(v) => [`${v} g`, "体重"]}
                  contentStyle={{
                    border: "1px solid #eee3d9",
                    borderRadius: 14,
                    fontSize: 13,
                  }}
                />
                <Line
                  dataKey="grams"
                  type="linear"
                  stroke="#bd785b"
                  strokeWidth={2.5}
                  dot={{
                    r: 5,
                    fill: "#bd785b",
                    stroke: "#fff",
                    strokeWidth: 3,
                  }}
                  activeDot={{ r: 8 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-note">
            {points.length === 1
              ? "第一枚成长坐标。下次称重后，将连成属于豹豹的曲线。"
              : "每个坐标都来自真实称重，日期间距按实际时间呈现。"}
          </p>
        </>
      ) : (
        <Empty title="这一段时光，还没有称重记录" icon="sprout">
          换一个时间范围，或点“记一笔”添加真实体重。
        </Empty>
      )}
    </>
  );
}
