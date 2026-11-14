import type { ReactNode } from "react";

/**
 * One section of Conta (and later Configurações): a title with a short description over a light
 * card. The sections follow each other in one column, read top to bottom.
 */
export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const titleId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={titleId} className="grid min-w-0 scroll-mt-4 gap-3 pt-6">
      <header>
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </header>
      <div className="settings-card">{children}</div>
    </section>
  );
}
