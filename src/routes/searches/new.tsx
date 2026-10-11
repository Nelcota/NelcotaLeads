import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/searches/new")({ component: NewSearchPage });

function NewSearchPage() {
  return <PageHeader title="Nova busca" />;
}
