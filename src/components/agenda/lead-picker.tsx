import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { foldText } from "@/lib/text-search";
import { cn } from "@/lib/utils";

type Lead = { id: string; name: string };

/** How many matches the list shows; typing narrows them. */
const SHOWN = 50;

/** "Lead" of a new meeting: a pill that opens a searchable list of the open leads. */
export function LeadPicker({
  leads,
  value,
  invalid,
  onChange,
}: {
  leads: readonly Lead[];
  value: string;
  invalid: boolean;
  onChange: (leadId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const chosen = leads.find((lead) => lead.id === value);
  const needle = foldText(query.trim());
  const matches = leads
    .filter((lead) => needle === "" || foldText(lead.name).includes(needle))
    .slice(0, SHOWN);
  return (
    <Popover
      modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          id="meeting-lead"
          aria-invalid={invalid || undefined}
          className={cn(
            "flex h-10 w-full items-center gap-1.5 rounded-full border bg-transparent pr-2.5 pl-3.5 text-left text-[16px] font-medium transition-colors hover:bg-fill-2 aria-expanded:bg-fill-2",
            invalid ? "border-red" : "border-border",
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", chosen ? "" : "text-muted-foreground")}>
            {chosen?.name ?? "Escolha o lead"}
          </span>
          <ChevronsUpDownIcon aria-hidden className="size-3 text-tertiary" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[60] grid w-(--radix-popover-trigger-width) gap-1 border border-border p-1.5 shadow-none"
      >
        <label className="flex h-9 items-center gap-2 rounded-lg bg-fill-2 px-2.5">
          <SearchIcon aria-hidden className="size-3.5 text-muted-foreground" />
          <input
            type="search"
            autoFocus
            aria-label="Buscar lead"
            placeholder="Buscar lead"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <div
          role="listbox"
          aria-label="Leads"
          className="grid max-h-[216px] overflow-y-auto overscroll-contain [scrollbar-width:thin]"
        >
          {matches.map((lead) => (
            <button
              key={lead.id}
              type="button"
              role="option"
              aria-selected={lead.id === value}
              onClick={() => {
                onChange(lead.id);
                setOpen(false);
              }}
              className={cn(
                "relative flex min-h-9 items-center rounded-lg py-2 pr-8 pl-2.5 text-left text-sm transition-colors hover:bg-fill-2",
                lead.id === value ? "font-semibold" : "",
              )}
            >
              {lead.name}
              {lead.id === value ? (
                <CheckIcon aria-hidden className="absolute right-2 size-4 text-primary" />
              ) : null}
            </button>
          ))}
          {matches.length === 0 ? (
            <p className="p-2.5 text-[14px] text-muted-foreground">Nenhum lead com esse nome.</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
