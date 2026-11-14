import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, CircleAlertIcon } from "@/components/icons";
import { EMAIL_OPT_OUT } from "@/lib/email-opt-out";
import { cn } from "@/lib/utils";
import { SETTINGS_SURFACE } from "./surface";
import { SettingsBlock } from "./settings-block";

/**
 * "Assinatura": the end of a first e-mail as the lead reads it (the sender lines and the opt-out
 * line the server adds). The sender is edited in Conta only.
 */
export function SignatureBlock({ name, company }: { name: string; company: string }) {
  const lines = [name, company].filter(Boolean);
  return (
    <SettingsBlock
      id="assinatura"
      title="Assinatura"
      description="Como o lead vê o fim de cada e-mail."
      action={
        <Link
          to="/conta"
          hash="remetente"
          className="inline-flex min-h-6 items-center gap-1 text-sm font-medium text-blue hover:underline"
        >
          Editar em Conta
          <ChevronRightIcon aria-hidden className="size-4" />
        </Link>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Nome e empresa do remetente:{" "}
        <span className="text-foreground">{lines.join(" · ") || "Ainda não informados"}</span>
      </p>
      <figure
        aria-label="Prévia da assinatura"
        className={cn(SETTINGS_SURFACE, "grid gap-3 px-5 py-4 leading-relaxed")}
      >
        <figcaption className="text-sm text-tertiary">Fim do e-mail</figcaption>
        {lines.length > 0 ? (
          <p className="font-medium whitespace-pre-line">{lines.join("\n")}</p>
        ) : (
          <p className="flex items-center gap-2 text-sm">
            <CircleAlertIcon aria-hidden className="size-4 shrink-0 text-orange" />
            Os e-mails vão sair sem assinatura.
          </p>
        )}
        <p className="text-sm text-muted-foreground">{EMAIL_OPT_OUT}</p>
      </figure>
    </SettingsBlock>
  );
}
