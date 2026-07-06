import { useEffect } from "react";
import { useAttackMonitor } from "./useAttackMonitor";

export function GlobalAttackMonitor() {
  useAttackMonitor();
  return null;
}
