import { LinkIcon } from "lucide-react";
import { SectionHeader } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INVITE_EMAILS_OFF } from "@/lib/team";

type InviteFormProps = {
  email: string;
  error: string | null;
  inviting: boolean;
  emailsEnabled: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  onCopyLink: () => void;
};

/** "E-mail do sócio" + "Convidar"; with sending off, the note and "Copiar link". */
export function InviteForm({
  email,
  error,
  inviting,
  emailsEnabled,
  onEmailChange,
  onSubmit,
  onCopyLink,
}: InviteFormProps) {
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <section className="enter min-w-0">
      <SectionHeader title="Convidar sócio" />
      <form className="grouped grid gap-3 p-4" onSubmit={submit} noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="invite-email">E-mail do sócio</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              placeholder="nome@empresa.com"
              className="min-w-0 flex-1 basis-56"
              value={email}
              aria-invalid={error ? true : undefined}
              onChange={(event) => onEmailChange(event.target.value)}
            />
            <Button type="submit" disabled={inviting}>
              {inviting ? "Convidando…" : "Convidar"}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-[14px] text-red">
              {error}
            </p>
          ) : null}
        </div>
        {emailsEnabled ? null : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 pt-3">
            <p className="min-w-0 flex-1 basis-60 text-[14px] text-muted-foreground">
              {INVITE_EMAILS_OFF}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={onCopyLink}>
              <LinkIcon />
              Copiar link
            </Button>
          </div>
        )}
      </form>
    </section>
  );
}
