import test from "node:test";
import assert from "node:assert/strict";
import {
  ageLabel,
  companionDays,
  weightStats,
  activities,
  csv,
  stamp,
} from "../src/lib/diary";
import { validateData, dateSchema } from "../src/lib/schema";
const base = {
  profile: {
    name: "王豹豹",
    englishName: "BaoBao",
    species: "豹纹守宫",
    speciesEnglish: "Leopard Gecko",
    birthDate: null,
    estimatedBirthMonth: "2026-08",
    arrivalDate: null,
    sex: "unknown",
    morph: null,
    appearance: "浅橘粉色",
    coverPhotoId: null,
  },
  weights: [],
  feedings: [],
  shedding: [],
  milestones: [],
  photos: [],
};
test("estimated month never invents exact birthday; corrected birthday changes age", () => {
  const d = validateData(base);
  assert.equal(ageLabel(d.profile, "2026-10-27"), "约 2 个月");
  assert.equal(
    ageLabel({ ...d.profile, birthDate: "2026-08-30" }, "2026-10-27"),
    "1 个月",
  );
  assert.equal(ageLabel(d.profile, "2027-08-01"), "约 1 岁");
});
test("unknown arrival stays empty and inclusive day count works", () => {
  const d = validateData(base);
  assert.equal(companionDays(d.profile, "2026-10-27"), null);
  assert.equal(
    companionDays({ ...d.profile, arrivalDate: "2026-10-27" }, "2026-10-27"),
    1,
  );
});
test("empty, single, unordered and irregular weigh-ins retain actual intervals", () => {
  const d = validateData(base);
  assert.equal(weightStats(d).max, null);
  d.weights = [{ id: "b", date: "2026-10-27", grams: 10, notes: "" }];
  assert.equal(weightStats(d, "2026-10-27").change, null);
  d.weights.push({ id: "a", date: "2026-09-01", grams: 8, notes: "" });
  const s = weightStats(d, "2026-10-27");
  assert.equal(s.change, 2);
  assert.equal(s.max, 10);
  assert.equal((stamp(s.rows[1].date) - stamp(s.rows[0].date)) / 86400000, 56);
});
test("invalid calendar dates, negative weights, duplicate IDs rejected", () => {
  assert.equal(dateSchema.safeParse("2026-02-30").success, false);
  assert.throws(() =>
    validateData({
      ...base,
      weights: [{ id: "a", date: "2026-10-27", grams: -1 }],
    }),
  );
  assert.throws(() =>
    validateData({
      ...base,
      weights: [
        { id: "a", date: "2026-10-27", grams: 10 },
        { id: "a", date: "2026-10-27", grams: 11 },
      ],
    }),
  );
});
test("future events are not reported as completed", () => {
  const d = validateData({
    ...base,
    milestones: [{ id: "future", date: "2027-08-01", title: "满一岁" }],
  });
  assert.equal(activities(d, "2026-10-27").length, 0);
});
test("photo paths must agree with month and reject traversal; cover must exist", () => {
  assert.throws(() =>
    validateData({
      ...base,
      photos: [
        {
          id: "p",
          date: "2026-10-27",
          src: "photos/2026-09/a.webp",
          thumbnail: "photos/2026-09/a-thumb.webp",
          title: "test",
        },
      ],
    }),
  );
  assert.throws(() =>
    validateData({
      ...base,
      profile: { ...base.profile, coverPhotoId: "missing" },
    }),
  );
});
test("CSV escapes multiline, quotes and spreadsheet formulas", () => {
  const text = csv([{ notes: '=SUM(A1)\n"quoted"', grams: 10 }]);
  assert.ok(text.includes('"\'=SUM(A1)\n""quoted"""'));
  assert.equal(csv([]), "");
});
