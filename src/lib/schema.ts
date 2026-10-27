import { z } from "zod";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "日期必须真实有效",
  );
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const text = z.string().trim().min(1);
const base = { id: text, date: dateSchema, notes: z.string().default("") };
export const profileSchema = z
  .object({
    name: text,
    englishName: text,
    species: text,
    speciesEnglish: text,
    birthDate: dateSchema.nullable(),
    estimatedBirthMonth: monthSchema.nullable(),
    arrivalDate: dateSchema.nullable(),
    sex: z.enum(["unknown", "male", "female"]),
    morph: text.nullable(),
    appearance: z.string(),
    coverPhotoId: text.nullable(),
  })
  .strict();
export const weightSchema = z
  .object({ ...base, grams: z.number().positive().finite() })
  .strict();
export const feedingSchema = z
  .object({
    ...base,
    food: text,
    quantity: z.number().int().nonnegative().nullable(),
    unit: text.default("只"),
    normal: z.boolean().nullable(),
    supplements: z.string().default(""),
  })
  .strict();
export const sheddingSchema = z
  .object({
    ...base,
    kind: z.enum(["shedding", "observation"]),
    complete: z.boolean().nullable(),
    retainedSkin: z.boolean().nullable(),
    mood: z.string(),
    stool: z.string(),
  })
  .strict();
export const milestoneSchema = z
  .object({ ...base, title: text, description: z.string().default("") })
  .strict();
const photoPath = z
  .string()
  .regex(
    /^photos\/\d{4}-(0[1-9]|1[0-2])\/[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png|avif)$/,
  );
export const photoSchema = z
  .object({
    ...base,
    src: photoPath,
    thumbnail: photoPath,
    title: text,
    description: z.string().default(""),
    capturedAt: z.string().nullable().default(null),
  })
  .strict()
  .refine(
    (p) =>
      p.src.split("/")[1] === p.date.slice(0, 7) &&
      p.thumbnail.split("/")[1] === p.date.slice(0, 7),
    "照片目录必须与日期月份一致",
  );
export const recordSchemas = {
  weights: weightSchema,
  feedings: feedingSchema,
  shedding: sheddingSchema,
  milestones: milestoneSchema,
  photos: photoSchema,
};
export type Collection = keyof typeof recordSchemas;
export type Profile = z.infer<typeof profileSchema>;
export type Weight = z.infer<typeof weightSchema>;
export type Feeding = z.infer<typeof feedingSchema>;
export type Shedding = z.infer<typeof sheddingSchema>;
export type Milestone = z.infer<typeof milestoneSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type DiaryData = {
  profile: Profile;
  weights: Weight[];
  feedings: Feeding[];
  shedding: Shedding[];
  milestones: Milestone[];
  photos: Photo[];
};
export function validateData(input: unknown): DiaryData {
  const object = z
    .object({
      profile: profileSchema,
      ...Object.fromEntries(
        Object.entries(recordSchemas).map(([k, s]) => [k, z.array(s)]),
      ),
    })
    .strict()
    .parse(input) as DiaryData;
  for (const key of Object.keys(recordSchemas) as Collection[]) {
    const ids = object[key].map((r) => r.id);
    if (new Set(ids).size !== ids.length)
      throw new Error(`${key}: 记录 ID 重复`);
  }
  if (
    object.profile.coverPhotoId &&
    !object.photos.some((p) => p.id === object.profile.coverPhotoId)
  )
    throw new Error("封面照片 ID 不存在");
  return object;
}
