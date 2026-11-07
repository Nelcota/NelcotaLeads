// Optional, so it is not in the generated worker-configuration.d.ts (see .dev.vars.example).
declare namespace Cloudflare {
  interface Env {
    /** "true" e-mails meeting invites and proposals; unset or anything else keeps it off. */
    SALES_EMAILS_ENABLED?: string;
    /** "true" e-mails the invite when someone is invited in Equipe; off: copy the link instead. */
    TEAM_INVITE_EMAILS_ENABLED?: string;
    /** "true" lets only invited e-mails create an account (the first account excepted). */
    INVITE_ONLY_SIGNUP?: string;
    /** "true" shows the notification center (bell, panel, preferences); unset keeps it off. */
    NOTIFICATIONS_ENABLED?: string;
  }
}
