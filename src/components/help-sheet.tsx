import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { Fragment } from "react";
import { Kbd, SectionHeader, TONE_TEXT } from "@/components/apple-ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { GLOSSARY, HELP_SHORTCUTS, HOW_IT_WORKS, keyLabel } from "@/lib/help";
import { systemStatusQuery } from "@/lib/queries";
import { isApplePlatform } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

/** "?" in the sidebar: how the app works, shortcuts, glossary and a line about Status. */
export function HelpSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-[440px]">
        <SheetHeader className="gap-1 px-5 pt-4 pb-3 pr-14">
          <SheetTitle className="text-lg">Ajuda</SheetTitle>
          <SheetDescription>O essencial do Nelcota Leads, em poucas linhas.</SheetDescription>
        </SheetHeader>
        {open ? <HelpContent onClose={() => onOpenChange(false)} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function HelpContent({ onClose }: { onClose: () => void }) {
  const apple = isApplePlatform();
  return (
    <div className="grid gap-6 px-4 pt-1 pb-6">
      <section className="min-w-0">
        <SectionHeader title="Como funciona" />
        <ol className="grouped">
          {HOW_IT_WORKS.map((step, index) => (
            <li
              key={step}
              className="grouped-row flex items-start gap-3 px-4 py-2.5 [--inset:48px]"
            >
              <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-fill-2 text-[12px] font-medium text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span className="font-light">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="min-w-0">
        <SectionHeader title="Atalhos de teclado" />
        <ul className="grouped">
          {HELP_SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.keys.join("+")}
              className="grouped-row flex min-h-[42px] items-center justify-between gap-4 px-4 py-2 [--inset:16px]"
            >
              <span className="font-light">{shortcut.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {shortcut.keys.map((key, index) => (
                  <Fragment key={key}>
                    {index > 0 ? <span className="text-xs text-tertiary">+</span> : null}
                    <Kbd>{keyLabel(key, apple)}</Kbd>
                  </Fragment>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="px-1.5 pt-2 text-[14px] font-light text-muted-foreground">
          Os atalhos de uma tecla não funcionam enquanto você digita.
        </p>
      </section>

      <section className="min-w-0">
        <SectionHeader title="Glossário" />
        <dl className="grouped">
          {Object.values(GLOSSARY).map((entry) => (
            <div key={entry.term} className="grouped-row grid gap-0.5 px-4 py-2.5 [--inset:16px]">
              <dt className="font-medium">{entry.term}</dt>
              <dd className="text-[14px] font-light text-muted-foreground">{entry.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="min-w-0">
        <SectionHeader title="Status" />
        <div className="grouped">
          <StatusSummary onClose={onClose} />
        </div>
      </section>
    </div>
  );
}

function StatusSummary({ onClose }: { onClose: () => void }) {
  const { data: jobs } = useQuery(systemStatusQuery);
  const failing = jobs?.filter((job) => job.reason === "failing") ?? [];
  const red = failing.some((job) => job.state === "error");
  const text = !jobs
    ? "Carregando…"
    : failing.length === 0
      ? "Nenhuma tarefa automática falhando."
      : failing.length === 1
        ? "1 tarefa automática está falhando."
        : `${failing.length} tarefas automáticas estão falhando.`;
  return (
    <Link
      to="/conta"
      hash="status"
      onClick={onClose}
      className="grouped-row row-hover flex min-h-[48px] items-center gap-3 px-4 py-2 transition-colors hover:bg-black/[0.025] dark:hover:bg-white/[0.03]"
    >
      <span
        aria-hidden
        className={cn(
          "size-2.5 shrink-0 rounded-full bg-current",
          TONE_TEXT[!jobs ? "gray" : failing.length === 0 ? "green" : red ? "red" : "orange"],
        )}
      />
      <span className="min-w-0 flex-1 font-light">{text}</span>
      <span className="flex shrink-0 items-center gap-1 text-[14px] font-medium text-blue">
        Ver status
        <ChevronRightIcon className="size-3.5" />
      </span>
    </Link>
  );
}
