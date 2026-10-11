import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/searches/")({ component: SearchesPage });

function SearchesPage() {
  return <PageHeader title="Buscas" />;
}
