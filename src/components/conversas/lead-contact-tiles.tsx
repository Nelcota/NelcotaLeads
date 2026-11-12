import { GlobeIcon, PhoneIcon, type LucideIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { ExternalLink, TONE_TEXT, type Tone } from "@/components/apple-ui";
import { WhatsAppMark } from "@/components/brand-marks";
import { whatsappLink } from "@/lib/phone";
import { cn, safeHttpUrl } from "@/lib/utils";

const TILE_CLASS =
  "grid min-h-[68px] flex-1 place-items-center content-center gap-1.5 rounded-[18px] bg-card text-xs font-medium text-foreground transition-[background-color,transform] duration-150 ease-spring hover:bg-fill-2 active:scale-[0.97]";

/** A contact shortcut: a solid tile with the icon over its name. */
function ContactTile({
  icon: Icon,
  tone,
  label,
  href,
  external,
}: {
  icon: LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;
  tone: Tone;
  label: string;
  href: string;
  external?: boolean;
}) {
  const content = (
    <>
      <Icon aria-hidden className={cn("size-5", TONE_TEXT[tone])} />
      {label}
    </>
  );
  if (external) {
    return (
      <ExternalLink href={href} indicator={false} className={TILE_CLASS}>
        {content}
      </ExternalLink>
    );
  }
  return (
    <a href={href} className={TILE_CLASS}>
      {content}
    </a>
  );
}

/** WhatsApp, Ligar and Site as three tiles; each shows only when the lead has that contact. */
export function LeadContactTiles({
  phone,
  phoneE164,
  website,
}: {
  phone: string | null;
  phoneE164: string | null;
  website: string | null;
}) {
  const site = safeHttpUrl(website);
  const dial = phoneE164 ?? phone;
  if (!dial && !site) return null;
  return (
    <div className="flex gap-2">
      {phoneE164 ? (
        <ContactTile
          icon={WhatsAppMark}
          tone="green"
          label="WhatsApp"
          href={whatsappLink(phoneE164)}
          external
        />
      ) : null}
      {dial ? (
        <ContactTile icon={PhoneIcon} tone="green" label="Ligar" href={`tel:${dial}`} />
      ) : null}
      {site ? <ContactTile icon={GlobeIcon} tone="blue" label="Site" href={site} external /> : null}
    </div>
  );
}
