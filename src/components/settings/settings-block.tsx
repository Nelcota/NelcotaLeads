import type { ReactNode } from "react";

/**
 * One section of a Configurações tab: title, one sentence and at most one action on the left;
 * the values or controls on the right. Sections of a tab split by a hairline; on a narrow
 * screen the left column sits on top.
 */
export function SettingsBlock({
  id,
  title,
  info,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  /** An InfoTip after the title. */
  info?: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  const titleId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className="flex scroll-mt-4 flex-wrap gap-x-10 gap-y-4 border-t border-black/[0.06] py-7 first:border-t-0 first:pt-1 dark:border-white/[0.06]"
    >
      <header className="flex max-w-[300px] min-w-0 flex-[1_1_240px] flex-col items-start gap-1">
        <h2 id={titleId} className="flex items-center gap-1.5 text-lg font-semibold">
          {title}
          {info}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        {action ? <div className="mt-2.5">{action}</div> : null}
      </header>
      <div className="min-w-0 flex-[999_1_420px]">{children}</div>
    </section>
  );
}
