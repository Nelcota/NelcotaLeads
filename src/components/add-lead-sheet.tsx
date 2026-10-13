import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlusIcon } from "lucide-react";
import { useState } from "react";
import { IconTile } from "@/components/apple-ui";
import { Field } from "@/components/field";
import { useUnsavedEditsGuard } from "@/components/unsaved-edits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CONTACT_LIMITS, contactPatch, type ContactField } from "@/lib/lead-contact";
import { errorToast } from "@/lib/mutation-toasts";
import { createLead } from "@/server/leads";

type Values = Record<ContactField, string>;
const EMPTY: Values = { name: "", email: "", phone: "", website: "" };

/** The first problem with what was typed, by field, checked the same way as on the server. */
function validate(values: Values): Partial<Values> {
  const errors: Partial<Values> = {};
  for (const field of ["name", "email", "phone", "website"] as const) {
    try {
      contactPatch(field, values[field]);
    } catch (error) {
      errors[field] = error instanceof Error ? error.message : "Valor inválido.";
    }
  }
  if (!errors.email && !errors.phone && !values.email.trim() && !values.phone.trim()) {
    errors.email = "Informe um e-mail ou um telefone.";
  }
  return errors;
}

/**
 * "Adicionar lead": a short form for a company found outside the searches. It opens the new
 * lead in the panel, or offers the one that already has that e-mail or phone.
 */
export function AddLeadSheet({
  open,
  onOpenChange,
  onOpenLead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenLead: (id: string) => void;
}) {
  const { guard, report, dialog } = useUnsavedEditsGuard("O lead que você digitou não foi salvo.");
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => (value ? onOpenChange(true) : guard(() => onOpenChange(false)))}
    >
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-[440px]">
        {dialog}
        {open ? (
          <AddLeadForm
            onDirty={report}
            onDone={(id) => {
              report(false);
              onOpenChange(false);
              onOpenLead(id);
            }}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function AddLeadForm({
  onDirty,
  onDone,
}: {
  onDirty: (dirty: boolean) => void;
  onDone: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Values>>({});
  const [submitted, setSubmitted] = useState(false);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);

  const change = (field: ContactField, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    setDuplicate(null);
    onDirty(Object.values(next).some((text) => text.trim() !== ""));
    if (submitted) setErrors(validate(next));
  };

  const create = useMutation({
    mutationFn: (data: Values) => createLead({ data }),
    onSuccess: async (result) => {
      if (result.status === "duplicate") {
        setDuplicate({ id: result.id, name: result.name });
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["leads"] }),
        queryClient.invalidateQueries({ queryKey: ["searches"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      onDone(result.id);
    },
    onError: errorToast("Não foi possível adicionar o lead"),
  });

  const submit = () => {
    setSubmitted(true);
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length === 0) create.mutate(values);
  };

  const input = (field: ContactField, props: React.ComponentProps<typeof Input>) => (
    <Input
      id={`add-lead-${field}`}
      value={values[field]}
      maxLength={CONTACT_LIMITS[field]}
      aria-invalid={Boolean(errors[field])}
      onChange={(event) => change(field, event.target.value)}
      {...props}
    />
  );

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <SheetHeader className="gap-1 px-5 pt-4 pb-3 pr-14">
        <SheetTitle className="flex items-center gap-2 text-lg">
          <IconTile icon={UserPlusIcon} tone="green" size={26} />
          Adicionar lead
        </SheetTitle>
        <SheetDescription>
          Uma empresa que você encontrou por fora. Com site, a IA analisa como as outras.
        </SheetDescription>
      </SheetHeader>
      <div className="grid gap-5 overflow-y-auto px-5 py-3">
        <Field label="Nome" htmlFor="add-lead-name" error={errors.name}>
          {input("name", { autoComplete: "organization", placeholder: "Ex.: Padaria Sol" })}
        </Field>
        <Field
          label="E-mail"
          htmlFor="add-lead-email"
          error={errors.email}
          hint="E-mail ou telefone: ao menos um dos dois."
        >
          {input("email", {
            type: "email",
            autoComplete: "email",
            placeholder: "contato@empresa.com.br",
          })}
        </Field>
        <Field label="Telefone" htmlFor="add-lead-phone" error={errors.phone}>
          {input("phone", { type: "tel", autoComplete: "tel", placeholder: "(31) 99876-5432" })}
        </Field>
        <Field
          label="Site"
          htmlFor="add-lead-website"
          error={errors.website}
          hint="Opcional. Com site, o lead entra na análise da IA."
        >
          {input("website", { type: "url", autoComplete: "url", placeholder: "empresa.com.br" })}
        </Field>
        {duplicate ? (
          <div
            role="status"
            className="flex flex-wrap items-center gap-3 rounded-xl bg-orange/12 px-3.5 py-3 text-sm"
          >
            <p className="min-w-0 flex-1 text-orange">
              Já existe um lead com esse e-mail ou telefone:{" "}
              <b className="font-medium">{duplicate.name}</b>.
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => onDone(duplicate.id)}>
              Abrir o existente
            </Button>
          </div>
        ) : null}
      </div>
      <SheetFooter className="flex-row justify-end gap-2 border-t border-border/70 px-5 pt-3.5 pb-5">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Adicionando…" : "Adicionar lead"}
        </Button>
      </SheetFooter>
    </form>
  );
}
