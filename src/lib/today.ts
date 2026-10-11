import { useState } from "react";
import { localDay } from "./format";

/** Today's day in Brazil time, fixed for the life of the component. */
export function useToday(): string {
  const [today] = useState(() => localDay(new Date()));
  return today;
}
