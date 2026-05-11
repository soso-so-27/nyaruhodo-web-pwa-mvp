import {
  getActiveCatProfile as selectActiveCatProfile,
  readActiveCatId,
  readCatProfiles,
} from "../components/home/homeInputHelpers";
import type { CatProfile } from "../components/home/homeInputHelpers";

export function loadCatProfiles(): CatProfile[] {
  return readCatProfiles();
}

export function getActiveCatProfile(profiles: CatProfile[]): CatProfile | null {
  if (profiles.length === 0) {
    return null;
  }

  return selectActiveCatProfile(profiles, readActiveCatId());
}
