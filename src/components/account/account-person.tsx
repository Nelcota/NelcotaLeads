import { Avatar } from "@/components/apple-ui";
import { formatDate } from "@/lib/format";

/** The top of Conta: the photo (opens the editor), the name and how the person signs in. */
export function AccountPerson({
  name,
  email,
  avatar,
  joinedAt,
  onChangePhoto,
}: {
  name: string;
  email: string | null;
  avatar: string | null;
  joinedAt: Date | null;
  onChangePhoto: () => void;
}) {
  const since = joinedAt ? `na equipe desde ${formatDate(new Date(joinedAt))}` : null;
  const line = [email, since].filter(Boolean).join(" · ");
  return (
    <div className="flex min-w-0 items-center gap-4">
      <button
        type="button"
        aria-label={avatar ? "Alterar foto do perfil" : "Adicionar foto do perfil"}
        onClick={onChangePhoto}
        className="press shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Avatar name={name} src={avatar} size={56} />
      </button>
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold tracking-[-0.01em]">{name}</p>
        {line ? (
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{line}</p>
        ) : null}
      </div>
    </div>
  );
}
