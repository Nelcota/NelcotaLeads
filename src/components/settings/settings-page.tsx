import { Page } from "@/components/app-shell";
import { LeaveGuard } from "@/components/leave-guard";
import type { SettingsTab } from "@/lib/settings-tabs";
import { AiTab } from "./ai-tab";
import { AutomationTab } from "./automation-tab";
import { EmailTab } from "./email-tab";
import { SettingsTabs } from "./settings-tabs";
import { SummaryTab } from "./summary-tab";
import { TemplatesTab } from "./templates-tab";

const TAB_CONTENT: Record<SettingsTab, () => React.JSX.Element> = {
  resumo: SummaryTab,
  email: EmailTab,
  automacao: AutomationTab,
  ia: AiTab,
  modelos: TemplatesTab,
};

/** Configurações in five tabs; only the open tab renders. */
export function SettingsPage({ tab }: { tab: SettingsTab }) {
  const Content = TAB_CONTENT[tab];
  return (
    <Page title="Configurações">
      <LeaveGuard>
        <div className="grid w-full max-w-[1088px] gap-6 pb-12">
          <SettingsTabs current={tab} />
          <Content />
        </div>
      </LeaveGuard>
    </Page>
  );
}
