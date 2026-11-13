import { Button } from "@/components/ui/button";
import { notificationPrefsSummary, type NotificationPrefs } from "@/lib/notifications";
import { NotificationExample } from "./notification-example";
import { SettingsRow } from "./settings-row";
import { SettingsSection } from "./settings-section";
import { ThemePicker } from "./theme-picker";

/** "Preferências": the theme as thumbnails and, when the bell is on, the notifications. */
export function PreferencesSection({
  notificationPrefs,
  onAdjustNotifications,
}: {
  /** Null while the bell is off (NOTIFICATIONS_ENABLED) or still loading: no row. */
  notificationPrefs: NotificationPrefs | null;
  onAdjustNotifications: () => void;
}) {
  return (
    <SettingsSection id="preferencias" title="Preferências" description="Valem só para você.">
      <SettingsRow label="Tema" align="top">
        <ThemePicker />
      </SettingsRow>
      {notificationPrefs ? (
        <SettingsRow
          label="Notificações"
          align="top"
          action={
            <Button variant="ghost" size="sm" onClick={onAdjustNotifications}>
              Ajustar
            </Button>
          }
        >
          <div className="grid gap-2.5">
            <span>{notificationPrefsSummary(notificationPrefs)}</span>
            <NotificationExample />
          </div>
        </SettingsRow>
      ) : null}
    </SettingsSection>
  );
}
