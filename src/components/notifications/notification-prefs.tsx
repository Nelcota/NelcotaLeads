import { CircleAlertIcon, Volume2Icon } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  CATEGORY_LABELS,
  NOTIFICATION_CATEGORIES,
  type CategoryPrefs,
  type NotificationCategory,
  type NotificationPrefs,
} from "@/lib/notifications";
import {
  playNotificationSound,
  requestSystemPermission,
  systemPermission,
  type SystemPermission,
} from "@/lib/notification-sound";
import { CategoryChip } from "./category-chip";
import { SegmentedControl } from "./segmented-control";

const SCOPE_OPTIONS = [
  { value: "mine", label: "Só dos meus leads" },
  { value: "all", label: "De todos os leads" },
] as const;

const SWITCHES: { key: keyof CategoryPrefs; label: string }[] = [
  { key: "show", label: "Mostrar" },
  { key: "sound", label: "Som" },
  { key: "system", label: "Aviso do sistema" },
];

const SWITCH_STYLE = { "--switch-on": "var(--primary)" } as CSSProperties;

const BLOCKED = "O navegador bloqueou os avisos. Libere em configurações do site para ativar.";

function withCategory(
  prefs: NotificationPrefs,
  category: NotificationCategory,
  change: Partial<CategoryPrefs>,
): NotificationPrefs {
  const current = prefs.categories[category];
  return { ...prefs, categories: { ...prefs.categories, [category]: { ...current, ...change } } };
}

function PermissionNote({ permission }: { permission: SystemPermission }) {
  if (permission === "granted" || permission === "default") return null;
  const text =
    permission === "unsupported" ? "Este navegador não mostra avisos do sistema." : BLOCKED;
  return (
    <span className="inline-flex items-start gap-1.5 text-[13px] leading-snug text-muted-foreground">
      <CircleAlertIcon
        aria-hidden
        className="mt-0.5 size-3.5 shrink-0 text-orange"
        strokeWidth={2}
      />
      {text}
    </span>
  );
}

function CategoryRow({
  category,
  value,
  systemBlocked,
  onChange,
}: {
  category: NotificationCategory;
  value: CategoryPrefs;
  /** The browser refused (or cannot show) system notifications: that switch stays off. */
  systemBlocked: boolean;
  onChange: (change: Partial<CategoryPrefs>) => void;
}) {
  const label = CATEGORY_LABELS[category];
  return (
    <div className="grid min-h-13 grid-cols-[minmax(0,1fr)_56px_56px_56px] items-center gap-1 border-t border-border">
      <span className="flex min-w-0 items-center gap-2.5">
        <CategoryChip category={category} size={28} className="rounded-[8px]" />
        <span className="text-sm leading-tight">{label}</span>
      </span>
      {SWITCHES.map((item) => {
        const hidden = item.key !== "show" && !value.show;
        const disabled = hidden || (item.key === "system" && systemBlocked);
        return (
          <span key={item.key} className="grid place-items-center">
            <Switch
              style={SWITCH_STYLE}
              checked={value[item.key] && !disabled}
              disabled={disabled}
              onCheckedChange={(checked) => onChange({ [item.key]: checked })}
              aria-label={`${item.label} para ${label}`}
            />
          </span>
        );
      })}
    </div>
  );
}

/** Whose notifications reach me, and per category: show, sound and the system notification. */
export function NotificationPrefsForm({
  prefs,
  onChange,
}: {
  prefs: NotificationPrefs;
  onChange: (prefs: NotificationPrefs) => void;
}) {
  const [permission, setPermission] = useState<SystemPermission>(() => systemPermission());

  const changeCategory = async (category: NotificationCategory, change: Partial<CategoryPrefs>) => {
    if (change.system !== true || permission === "granted") {
      onChange(withCategory(prefs, category, change));
      return;
    }
    const answer = await requestSystemPermission();
    setPermission(answer);
    if (answer !== "granted") {
      toast.error(
        answer === "unsupported" ? "Este navegador não mostra avisos do sistema." : BLOCKED,
      );
      return;
    }
    onChange(withCategory(prefs, category, change));
  };

  return (
    <>
      <div className="flex flex-col gap-2 px-5 pt-2 pb-4">
        <h3 className="text-[13px] font-semibold text-muted-foreground">Receber notificações de</h3>
        <SegmentedControl
          label="Receber notificações de"
          value={prefs.scope}
          options={SCOPE_OPTIONS}
          onChange={(scope) => onChange({ ...prefs, scope })}
        />
        <p className="text-[13px] leading-snug text-muted-foreground">
          Lead sem responsável e buscas concluídas avisam todos os sócios.
        </p>
      </div>

      <div className="flex flex-col px-5 pt-1 pb-2">
        <div className="grid grid-cols-[minmax(0,1fr)_56px_56px_56px] items-end gap-1 pb-1.5 text-xs font-semibold text-muted-foreground">
          <span>Categoria</span>
          <span className="text-center">Mostrar</span>
          <span className="text-center">Som</span>
          <span
            className="text-center"
            title="Aviso do Windows ou do celular quando a aba está em segundo plano"
          >
            Sistema
          </span>
        </div>
        {NOTIFICATION_CATEGORIES.map((category) => (
          <CategoryRow
            key={category}
            category={category}
            value={prefs.categories[category]}
            systemBlocked={permission === "denied" || permission === "unsupported"}
            onChange={(change) => void changeCategory(category, change)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-2 pb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => void playNotificationSound()}>
            <Volume2Icon aria-hidden />
            Testar som
          </Button>
          <PermissionNote permission={permission} />
        </div>
        <p className="text-[13px] leading-snug text-muted-foreground">
          Som e aviso do sistema começam desligados. O aviso do sistema só aparece com a aba em
          segundo plano.
        </p>
      </div>
    </>
  );
}
