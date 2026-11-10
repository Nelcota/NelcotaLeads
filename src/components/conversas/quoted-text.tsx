import { useId, useState } from "react";
import { Button } from "@/components/ui/button";

/** The original message a reply quotes, hidden until asked. */
export function QuotedText({ quoted }: { quoted: string }) {
  const [open, setOpen] = useState(false);
  const quotedId = useId();
  return (
    <div className="grid justify-items-start">
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={open ? quotedId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Ocultar" : "Mostrar mensagem anterior"}
      </Button>
      {open ? (
        <p
          id={quotedId}
          className="mt-1 border-l-2 border-border pl-3 text-sm leading-relaxed whitespace-pre-line wrap-break-word text-muted-foreground"
        >
          {quoted}
        </p>
      ) : null}
    </div>
  );
}
