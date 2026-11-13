import { TriangleAlertIcon } from "lucide-react";
import { EMAIL_OPT_OUT } from "@/lib/email-opt-out";

/**
 * How the end of a first e-mail reads to the lead: the same signature lines and opt-out line the
 * server adds. Follows what is being typed, so an edit is seen before it is saved.
 */
export function SignaturePreview({ name, company }: { name: string; company: string }) {
  const lines = [name, company].filter(Boolean);
  return (
    <figure className="settings-row grid gap-2 pt-4 pb-5" aria-label="Prévia da assinatura">
      {lines.length === 0 ? (
        <p className="flex items-center gap-2 text-sm">
          <TriangleAlertIcon aria-hidden className="size-4 shrink-0 text-orange" />
          Os e-mails vão sair sem assinatura. Preencha o nome ou a empresa.
        </p>
      ) : null}
      <figcaption className="text-sm text-muted-foreground">
        Assim o fim do primeiro e-mail aparece para o lead
      </figcaption>
      <div className="grid gap-3 rounded-xl bg-window px-4 py-4 leading-relaxed">
        <p className="text-muted-foreground">
          …e posso mandar dois exemplos de sites que fizemos para empresas da região?
        </p>
        {lines.length > 0 ? (
          <p className="font-medium whitespace-pre-line">{lines.join("\n")}</p>
        ) : (
          <p className="text-muted-foreground">Sem assinatura</p>
        )}
        <p className="text-sm text-muted-foreground">{EMAIL_OPT_OUT}</p>
      </div>
    </figure>
  );
}
