import { ChevronLeftIcon, PanelRightCloseIcon, PanelRightOpenIcon } from "@/components/icons";
import { Avatar, Hint } from "@/components/apple-ui";
import { ConversationOwnerControl } from "@/components/conversas/conversation-owner-control";
import { Button } from "@/components/ui/button";
import type { ConversationOwner } from "@/lib/conversation-owner";

/**
 * The open conversation's header: back button, who the lead is, who answers (while the
 * conversation is open) and the toggle for the lead panel.
 */
export function ThreadHeader({
  name,
  email,
  closed,
  owner,
  ownerBusy,
  panelOpen,
  onBack,
  onOwnerChange,
  onTogglePanel,
}: {
  name: string;
  email: string | null;
  closed: boolean;
  owner: ConversationOwner;
  ownerBusy: boolean;
  panelOpen: boolean;
  onBack: () => void;
  onOwnerChange: (aiMode: boolean) => void;
  onTogglePanel: () => void;
}) {
  const panelLabel = panelOpen ? "Esconder dados do lead" : "Mostrar dados do lead";
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-7">
      <Hint label="Voltar (Esc)">
        <Button
          variant="outline"
          size="icon"
          className="lg:hidden"
          onClick={onBack}
          aria-label="Voltar"
        >
          <ChevronLeftIcon />
        </Button>
      </Hint>
      <Avatar name={name} size={40} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold">{name}</h2>
        <p className="truncate text-sm text-muted-foreground">{email ?? "sem e-mail"}</p>
      </div>
      {!closed ? (
        <ConversationOwnerControl owner={owner} busy={ownerBusy} onChange={onOwnerChange} />
      ) : null}
      <Hint label={panelLabel}>
        <Button
          variant="outline"
          size="icon"
          className="max-xl:hidden"
          aria-pressed={panelOpen}
          aria-label={panelLabel}
          onClick={onTogglePanel}
        >
          {panelOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
        </Button>
      </Hint>
    </div>
  );
}
