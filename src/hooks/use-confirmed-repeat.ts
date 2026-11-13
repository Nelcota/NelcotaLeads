import { useState } from "react";
import type { Search } from "@/db/schema";
import { useRepeatSearch } from "@/hooks/use-search-actions";
import { isSaturated } from "@/lib/previous-search";

/**
 * "Buscar de novo" and "Tentar de novo" for one search row: right away, unless that search came
 * back mostly with known companies, in which case the row asks first (SaturatedSearchConfirm).
 */
export function useConfirmedRepeat(search: Search) {
  const repeat = useRepeatSearch();
  const [confirming, setConfirming] = useState(false);

  const request = () => {
    if (isSaturated(search)) {
      setConfirming(true);
      return;
    }
    repeat.mutate(search.id);
  };

  const confirm = () => {
    setConfirming(false);
    repeat.mutate(search.id);
  };

  return {
    request,
    confirm,
    cancel: () => setConfirming(false),
    confirming,
    pending: repeat.isPending,
  };
}
