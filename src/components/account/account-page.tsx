import { Page } from "@/components/app-shell";
import { AvatarEditor } from "@/components/avatar-editor";
import { LeaveGuard } from "@/components/leave-guard";
import { useState } from "react";
import { useAccount } from "@/hooks/use-account";
import { useAvatarEditor } from "@/hooks/use-avatar-editor";
import { useNotifications } from "@/hooks/use-notifications";
import { useSystemOverview } from "@/hooks/use-system-overview";
import { useWorkCounts } from "@/hooks/use-work-counts";
import { AccountPerson } from "./account-person";
import { NotificationPrefsSheet } from "./notification-prefs-sheet";
import { PreferencesSection } from "./preferences-section";
import { ProfileSection } from "./profile-section";
import { SenderSection } from "./sender-section";
import { SessionSection } from "./session-section";
import { SystemSection } from "./system-section";
import { WorkShortcuts } from "./work-shortcuts";

/**
 * Conta in one column read top to bottom: the person and the four work shortcuts, then Perfil, Remetente
 * dos e-mails, Preferências, Sistema and Sessão. Values are text until "Editar" opens one row.
 */
export function AccountPage() {
  const page = useAccount();
  const photo = useAvatarEditor();
  const notifications = useNotifications();
  const counts = useWorkCounts(page.userId);
  const system = useSystemOverview();
  const [tasksOpen, setTasksOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const prefs = notifications?.data.prefs ?? null;

  return (
    <Page title="Conta">
      <LeaveGuard>
        <div className="grid w-full max-w-[880px] pb-10">
          <AccountPerson
            name={page.name}
            email={page.email}
            avatar={page.avatar}
            joinedAt={page.joinedAt}
            onChangePhoto={photo.openEditor}
          />
          <WorkShortcuts
            userId={page.userId}
            attention={counts.attention}
            myToday={counts.myToday}
          />
          <ProfileSection
            name={page.name}
            email={page.email}
            avatar={page.avatar}
            onChangePhoto={photo.openEditor}
          />
          <SenderSection />
          <PreferencesSection
            notificationPrefs={prefs}
            onAdjustNotifications={() => setNotificationsOpen(true)}
          />
          <SystemSection
            summary={system.summary}
            jobs={system.jobs}
            now={system.now}
            usage={system.usage}
            open={tasksOpen}
            onToggle={() => setTasksOpen((open) => !open)}
          />
          <SessionSection />
        </div>
      </LeaveGuard>
      <AvatarEditor
        key={photo.session}
        open={photo.open}
        onOpenChange={photo.setOpen}
        name={page.name}
        current={page.avatar}
        saving={photo.saving}
        onSave={photo.save}
      />
      {notifications && prefs ? (
        <NotificationPrefsSheet
          open={notificationsOpen}
          onOpenChange={setNotificationsOpen}
          prefs={prefs}
          onChange={notifications.savePrefs}
        />
      ) : null}
    </Page>
  );
}
