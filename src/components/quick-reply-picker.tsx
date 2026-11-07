import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageSquareTextIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Hint } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { quickRepliesQuery } from "@/lib/queries";
import { matchesQuery } from "@/lib/text-search";

/**
 * "Modelos" in the composer: a filterable list of the user's quick replies. Picking one hands
 * its text to `onPick` (which inserts it where the caret was) and closes the list.
 */
export function QuickReplyPicker({
  onPick,
  disabled,
}: {
  onPick: (text: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  // A pick moves the focus to the reply itself, not back to this button.
  const picked = useRef(false);
  const { data, isError } = useQuery(quickRepliesQuery);
  const items = (data ?? []).filter((item) => matchesQuery([item.title, item.body], filter));

  const pick = (text: string) => {
    picked.current = true;
    setOpen(false);
    setFilter("");
    onPick(text);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setFilter("");
      }}
    >
      <Hint label="Modelos">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Modelos" disabled={disabled}>
            <MessageSquareTextIcon />
          </Button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent
        side="top"
        align="start"
        className="grid w-80 gap-1 p-1.5"
        onCloseAutoFocus={(event) => {
          if (picked.current) event.preventDefault();
          picked.current = false;
        }}
      >
        <Input
          autoFocus
          type="search"
          aria-label="Filtrar modelos"
          autoComplete="off"
          placeholder="Filtrar modelos"
          className="h-8"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          onKeyDown={(event) => {
            const first = items[0];
            if (event.key !== "Enter" || !first) return;
            event.preventDefault();
            pick(first.body);
          }}
        />
        {data === undefined ? (
          <p className="px-2 py-3 text-sm font-light text-muted-foreground">
            {isError ? "Não foi possível carregar os modelos." : "Carregando…"}
          </p>
        ) : data.length === 0 ? (
          <p className="px-2 py-3 text-sm font-light text-muted-foreground">Nenhum modelo ainda.</p>
        ) : items.length === 0 ? (
          <p className="px-2 py-3 text-sm font-light text-muted-foreground">
            Nenhum modelo com “{filter.trim()}”.
          </p>
        ) : (
          <ul aria-label="Modelos" className="grid max-h-64 overflow-y-auto overscroll-contain">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => pick(item.body)}
                  className="grid w-full gap-0.5 rounded-lg px-2 py-2 text-left hover:bg-fill-3 focus-visible:bg-fill-3 focus-visible:outline-none"
                >
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  <span className="line-clamp-2 text-xs font-light text-muted-foreground">
                    {item.body}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-border/70 pt-1">
          <Link
            to="/settings"
            hash="respostas"
            className="flex h-8 items-center rounded-lg px-2 text-[14px] font-medium text-blue hover:bg-fill-3"
          >
            {data?.length ? "Editar modelos" : "Criar modelos em Configurações"}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
