import { useTemplatesTab } from "@/hooks/use-templates-tab";
import { QuickRepliesBlock } from "./quick-replies-block";
import { ServicesBlock } from "./services-block";

/** Modelos e serviços: the team's quick replies and the service table. */
export function TemplatesTab() {
  const page = useTemplatesTab();
  return (
    <div>
      <QuickRepliesBlock replies={page.replies} failed={page.repliesFailed} />
      <ServicesBlock table={page.table} failed={page.tableFailed} />
    </div>
  );
}
