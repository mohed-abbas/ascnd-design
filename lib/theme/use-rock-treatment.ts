"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_ROCK_TREATMENT,
  getRockTreatment,
  subscribeRockTreatment,
  type RockTreatment,
} from "./rock-treatment";

/** React binding for the rock-treatment store (server snapshot = the default). */
export function useRockTreatment(): RockTreatment {
  return useSyncExternalStore(
    subscribeRockTreatment,
    getRockTreatment,
    () => DEFAULT_ROCK_TREATMENT,
  );
}
