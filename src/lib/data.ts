import profile from "../data/profile.json";
import weights from "../data/weights.json";
import feedings from "../data/feedings.json";
import shedding from "../data/shedding.json";
import milestones from "../data/milestones.json";
import photos from "../data/photos.json";
import { validateData } from "./schema";
export const data = validateData({
  profile,
  weights,
  feedings,
  shedding,
  milestones,
  photos,
});
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;
