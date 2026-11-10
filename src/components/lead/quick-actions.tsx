import { CopyIcon, GlobeIcon, PhoneIcon } from "lucide-react";
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { toast } from "sonner";
import { ExternalLink, ExternalMark, TONE_TEXT, type Tone } from "@/components/apple-ui";
import { GoogleMapsMark, WhatsAppMark } from "@/components/brand-marks";
import { buttonVariants } from "@/components/ui/button";
import type { Lead } from "@/db/schema";
import { whatsappLink } from "@/lib/phone";
import { cn, safeHttpUrl } from "@/lib/utils";

/**
 * The lead's contact shortcuts (WhatsApp, Ligar, Copiar telefone, Site, Google Maps) in a fixed
 * 2-column grid of secondary pills: every shortcut stays visible, nothing scrolls sideways.
 */
export function QuickActions({ lead }: { lead: Lead }) {
  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(lead.phone ?? "");
      toast.success("Telefone copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <nav aria-label="Contato rápido" className="grid grid-cols-2 gap-2">
      {lead.phoneE164 ? (
        <>
          <QuickAction
            href={whatsappLink(lead.phoneE164)}
            external
            icon={WhatsAppMark}
            tone="green"
          >
            WhatsApp
          </QuickAction>
          <QuickAction href={`tel:${lead.phoneE164}`} icon={PhoneIcon} tone="green">
            Ligar
          </QuickAction>
        </>
      ) : null}
      {lead.phone ? (
        <QuickAction as="button" onClick={() => void copyPhone()} icon={CopyIcon} tone="gray">
          Copiar telefone
        </QuickAction>
      ) : null}
      {safeHttpUrl(lead.website) ? (
        <QuickAction
          href={safeHttpUrl(lead.website) ?? undefined}
          external
          icon={GlobeIcon}
          tone="blue"
        >
          Site
        </QuickAction>
      ) : null}
      {safeHttpUrl(lead.mapsUrl) ? (
        <QuickAction
          href={safeHttpUrl(lead.mapsUrl) ?? undefined}
          external
          icon={GoogleMapsMark}
          tone="red"
        >
          Google Maps
        </QuickAction>
      ) : null}
    </nav>
  );
}

/** A contact shortcut: a secondary pill (button standard) with a bare line icon in its tone. */
function QuickAction(
  props: {
    icon: ComponentType<{ className?: string; strokeWidth?: number }>;
    tone: Tone;
    children: ReactNode;
  } & (
    | ({ as?: undefined; external?: boolean } & ComponentProps<"a">)
    | ({ as: "button" } & ComponentProps<"button">)
  ),
) {
  const className = cn(buttonVariants({ variant: "outline" }), "w-full", TONE_TEXT[props.tone]);
  const Icon = props.icon;
  // Icon standard: a bare line icon in its tone (brand mark for WhatsApp and Maps), no chip.
  const icon = <Icon className="size-[18px]" strokeWidth={1.75} />;
  const body = (
    <>
      {icon}
      <span className="text-foreground">{props.children}</span>
    </>
  );
  if (props.as === "button") {
    const { icon: _icon, tone: _tone, children: _children, as: _as, ...rest } = props;
    return (
      <button type="button" className={className} {...rest}>
        {body}
      </button>
    );
  }
  const { icon: _icon, tone: _tone, children, as: _as, external, ...rest } = props;
  if (external) {
    return (
      <ExternalLink className={className} indicator={false} {...rest}>
        {icon}
        <span className="inline-flex items-center gap-0.5 text-foreground">
          {children}
          <ExternalMark />
        </span>
      </ExternalLink>
    );
  }
  return (
    <a className={className} {...rest}>
      {body}
    </a>
  );
}
