import { Link } from "@tanstack/react-router";
import { pluralize } from "@/lib/format";
import { SCORE_TIERS } from "@/lib/schemas";

/** "3 com nota alta": a search's best leads, opened in Leads with the high-score filter on. */
export function HighScoreLink({ searchId, count }: { searchId: string; count: number }) {
  return (
    <Link
      to="/leads"
      search={{ view: "all", searchId, minScore: SCORE_TIERS.high.min }}
      className="w-fit font-medium text-blue hover:underline"
    >
      {pluralize(count, "com nota alta", "com nota alta")}
    </Link>
  );
}
