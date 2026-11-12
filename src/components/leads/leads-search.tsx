import { SearchIcon, XIcon } from "lucide-react";
import { forwardRef, useRef } from "react";
import { Kbd } from "@/components/apple-ui";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUrlSearchBox } from "@/hooks/use-url-search-box";

export const LIST_SHORTCUTS = [
  { keys: ["/"], label: "Buscar" },
  { keys: ["X"], label: "Marcar o lead em foco" },
  { keys: ["E"], label: "Escrever e-mail" },
  { keys: ["W"], label: "Abrir o WhatsApp" },
  { keys: ["J", "K"], label: "Próximo e anterior no painel" },
  { keys: ["Esc"], label: "Fechar o painel" },
  { keys: ["?"], label: "Ajuda e todos os atalhos" },
] as const;

/**
 * The search box: name, e-mail, phone or address. It also carries the "/" hint and a "?" that
 * lists the keyboard shortcuts, so they live with the search instead of a button of their own.
 */
export const LeadsSearch = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onCommit: (value: string) => void;
    shortcutsOpen: boolean;
    onShortcutsOpenChange: (open: boolean) => void;
  }
>(function LeadsSearch({ value: urlValue, onCommit, shortcutsOpen, onShortcutsOpenChange }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const box = useUrlSearchBox(urlValue, onCommit);
  const q = box.value;

  return (
    <div className="relative w-full sm:w-[420px]">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-tertiary" />
      <Input
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        type="search"
        aria-label="Buscar por nome, e-mail, telefone ou bairro"
        placeholder="Buscar por nome, e-mail, telefone ou bairro"
        className="h-9 rounded-full border border-border pr-20 pl-10"
        {...box.inputProps}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !q) return;
          // Only the search: Esc doesn't also close what is around it.
          event.preventDefault();
          event.stopPropagation();
          box.clear();
        }}
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1.5">
        {q ? (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => {
              box.clear();
              inputRef.current?.focus();
            }}
            className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-fill hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : (
          <Kbd aria-hidden className="max-sm:hidden">
            /
          </Kbd>
        )}
        <Popover open={shortcutsOpen} onOpenChange={onShortcutsOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Atalhos de teclado"
              className="relative grid size-6 place-items-center rounded-full border border-border touch-target text-xs font-bold text-muted-foreground hover:bg-fill hover:text-foreground max-sm:hidden"
            >
              ?
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={10}
            className="grid w-[280px] gap-2 rounded-[16px] border border-border bg-popover p-4 shadow-none backdrop-blur-none"
          >
            <p className="mb-1 text-base font-semibold">Atalhos</p>
            {LIST_SHORTCUTS.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
              >
                <span>{item.label}</span>
                <span className="flex gap-1">
                  {item.keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
});
