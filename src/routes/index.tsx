import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/")({ component: LeadsPage });

function LeadsPage() {
  return <PageHeader title="Leads" description="Leads qualificados por IA, ordenados por nota." />;
}
