import { Link } from "@tanstack/react-router";
import { MessagesSquareIcon } from "lucide-react";
import { EmptyState } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";

/** What the thread column shows before a conversation is open, with a shortcut to the next one. */
export function NoConversationOpen({ nextLeadId }: { nextLeadId: string | undefined }) {
  return (
    <EmptyState icon={MessagesSquareIcon} title="Escolha uma conversa à esquerda.">
      {nextLeadId ? (
        <Button asChild size="sm" variant="link">
          <Link from="/conversas" to="." search={(prev) => ({ ...prev, lead: nextLeadId })}>
            Abrir a próxima que precisa de você
          </Link>
        </Button>
      ) : null}
    </EmptyState>
  );
}
