import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  calendarEntries,
  calendarRange,
  DEFAULT_ZOOM,
  stepAnchor,
  VIEW_LABELS,
  ZOOM_LEVELS,
  type CalendarView,
} from "@/lib/calendar";
import { localDay, localTime } from "@/lib/format";
import { agendaQuery } from "@/lib/queries";

export type AgendaSearch = { owner?: string; view?: CalendarView; date?: string };

type Place = { view: CalendarView; anchor: string };

/** How many view changes "Voltar" remembers. */
const HISTORY_LIMIT = 10;

/**
 * The Agenda's calendar state: the view and day (kept in the URL), the owner filter, the zoom
 * and the views visited before, plus the entries of the visible days. On a phone it is always
 * the Day view.
 */
export function useAgendaCalendar(
  search: AgendaSearch,
  setSearch: (next: AgendaSearch) => void,
  isMobile: boolean,
) {
  const clientToday = localDay(new Date());
  const view: CalendarView = isMobile ? "dia" : (search.view ?? "semana");
  const anchor = search.date ?? clientToday;
  const owner = search.owner ?? null;
  const range = calendarRange(view, anchor);
  const query = useQuery(agendaQuery(owner, range.from, range.to));
  const [history, setHistory] = useState<Place[]>([]);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  const today = query.data?.today ?? clientToday;
  const entries = useMemo(
    () => (query.data ? calendarEntries(query.data.entries, query.data.today) : []),
    [query.data],
  );

  // On a phone the view is always Day, so the URL keeps the view it had (for a desktop later).
  const show = (place: Place) =>
    setSearch({
      ...search,
      view: isMobile ? search.view : place.view,
      date: place.anchor === today ? undefined : place.anchor,
    });

  const goTo = (nextView: CalendarView, nextAnchor: string) => {
    if (nextView === view && nextAnchor === anchor) return;
    if (nextView !== view) {
      setHistory((previous) => [...previous, { view, anchor }].slice(-HISTORY_LIMIT));
    }
    show({ view: nextView, anchor: nextAnchor });
  };

  const goBack = () => {
    const last = history.at(-1);
    if (!last) return;
    setHistory((previous) => previous.slice(0, -1));
    show(last);
  };

  const previous = history.at(-1);

  return {
    view,
    anchor,
    owner,
    today,
    now: query.data?.now ?? localTime(new Date()),
    entries,
    team: query.data?.team ?? [],
    loading: !query.data && !query.isError,
    failed: !query.data && query.isError,
    zoom,
    canZoomOut: zoom > 0,
    canZoomIn: zoom < ZOOM_LEVELS.length - 1,
    zoomOut: () => setZoom((value) => Math.max(0, value - 1)),
    zoomIn: () => setZoom((value) => Math.min(ZOOM_LEVELS.length - 1, value + 1)),
    goTo,
    pickDay: (day: string) => show({ view, anchor: day }),
    step: (direction: -1 | 1) => show({ view, anchor: stepAnchor(view, anchor, direction) }),
    goToday: () => show({ view, anchor: today }),
    setOwner: (next: string | null) => setSearch({ ...search, owner: next ?? undefined }),
    backLabel: previous ? backLabel(previous.view) : null,
    goBack,
  };
}

const BACK_LABELS: Record<CalendarView, string> = {
  mes: `Voltar ao ${VIEW_LABELS.mes}`,
  semana: `Voltar à ${VIEW_LABELS.semana}`,
  dia: `Voltar ao ${VIEW_LABELS.dia}`,
};

function backLabel(view: CalendarView): string {
  return BACK_LABELS[view];
}

export type AgendaCalendar = ReturnType<typeof useAgendaCalendar>;
