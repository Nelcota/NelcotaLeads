import { PauseIcon, PlayIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDispatchControl } from "@/hooks/use-dispatch-control";

/** "Pausar" ↔ "Retomar" and "Cancelar disparo", with an inline confirmation before cancelling. */
export function DispatchControls({
  paused,
  cancellable,
}: {
  paused: boolean;
  cancellable: number;
}) {
  const control = useDispatchControl();
  if (control.confirming) {
    return (
      <div role="alert" className="grid gap-3 rounded-[14px] bg-card-2 px-3.5 py-3 text-sm">
        <p>
          {cancellable === 1
            ? "Cancelar o e-mail que ainda não saiu hoje? O lead volta para A contatar."
            : `Cancelar os ${cancellable} e-mails que ainda não saíram hoje? Os leads voltam para A contatar.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            onClick={control.confirmCancel}
            disabled={control.cancelling}
          >
            {control.cancelling ? "Cancelando…" : "Confirmar"}
          </Button>
          <Button variant="outline" onClick={control.keepRunning} disabled={control.cancelling}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {paused ? (
        <Button variant="outline" onClick={control.resume} disabled={control.switching}>
          <PlayIcon />
          {control.switching ? "Retomando…" : "Retomar"}
        </Button>
      ) : (
        <Button variant="outline" onClick={control.pause} disabled={control.switching}>
          <PauseIcon />
          {control.switching ? "Pausando…" : "Pausar"}
        </Button>
      )}
      {cancellable > 0 ? (
        <Button variant="destructive" onClick={control.askCancel}>
          <XIcon />
          Cancelar disparo
        </Button>
      ) : null}
    </div>
  );
}
