import { ImageIcon, ImageUpIcon } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AVATAR_ACCEPT, loadAvatarImage, renderAvatar } from "@/lib/avatar-image";
import { cn } from "@/lib/utils";

const FRAME = 216;
const MAX_ZOOM = 4;
const KEY_STEP = 8;

type Picked = { image: ImageBitmap; url: string };
type Offset = { x: number; y: number };

/** Keeps the photo covering the whole circle: no empty edge can be dragged into view. */
function clampOffset(offset: Offset, width: number, height: number): Offset {
  return {
    x: Math.min(0, Math.max(FRAME - width, offset.x)),
    y: Math.min(0, Math.max(FRAME - height, offset.y)),
  };
}

function coverScale(image: ImageBitmap) {
  return FRAME / Math.min(image.width, image.height);
}

/**
 * The macOS "edit picture" sheet: pick or drop a photo, drag it inside the circle, zoom with
 * the slider (or the wheel), then save. Only the visible square is uploaded. Give it a new `key`
 * each time it opens so every sheet starts clean.
 */
export function AvatarEditor({
  open,
  onOpenChange,
  name,
  current,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  current?: string | null;
  saving: boolean;
  onSave: (avatar: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; from: Offset } | null>(
    null,
  );
  const [picked, setPicked] = useState<Picked | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [dropping, setDropping] = useState(false);

  useEffect(() => {
    if (!picked) return undefined;
    return () => {
      URL.revokeObjectURL(picked.url);
      picked.image.close();
    };
  }, [picked]);

  const scale = picked ? coverScale(picked.image) * zoom : 1;
  const width = picked ? picked.image.width * scale : FRAME;
  const height = picked ? picked.image.height * scale : FRAME;

  const choose = async (file: File | undefined) => {
    if (!file) return;
    const image = await loadAvatarImage(file).catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir essa imagem.");
      return null;
    });
    if (!image) return;
    const cover = coverScale(image);
    setPicked({ image, url: URL.createObjectURL(file) });
    setZoom(1);
    setOffset({
      x: (FRAME - image.width * cover) / 2,
      y: (FRAME - image.height * cover) / 2,
    });
  };

  // Zooming keeps the point under the circle's center fixed, like Photos.
  const zoomTo = (next: number) => {
    if (!picked) return;
    const bounded = Math.min(MAX_ZOOM, Math.max(1, next));
    const cover = coverScale(picked.image);
    const ratio = bounded / zoom;
    const center = FRAME / 2;
    const moved = {
      x: center - (center - offset.x) * ratio,
      y: center - (center - offset.y) * ratio,
    };
    setZoom(bounded);
    setOffset(
      clampOffset(
        moved,
        picked.image.width * cover * bounded,
        picked.image.height * cover * bounded,
      ),
    );
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!picked || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      from: offset,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const grab = drag.current;
    if (!grab || grab.pointerId !== event.pointerId) return;
    const next = {
      x: grab.from.x + event.clientX - grab.startX,
      y: grab.from.y + event.clientY - grab.startY,
    };
    setOffset(clampOffset(next, width, height));
  };

  const endDrag = () => {
    drag.current = null;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!picked) return;
    const moves: Record<string, Offset> = {
      ArrowLeft: { x: KEY_STEP, y: 0 },
      ArrowRight: { x: -KEY_STEP, y: 0 },
      ArrowUp: { x: 0, y: KEY_STEP },
      ArrowDown: { x: 0, y: -KEY_STEP },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setOffset(clampOffset({ x: offset.x + move.x, y: offset.y + move.y }, width, height));
  };

  const save = () => {
    if (!picked) return;
    const avatar = renderAvatar(picked.image, {
      x: -offset.x / scale,
      y: -offset.y / scale,
      side: FRAME / scale,
    });
    onSave(avatar);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Foto do perfil</DialogTitle>
          <DialogDescription>
            {picked
              ? "Arraste para posicionar e use o controle para aproximar."
              : "Escolha uma foto ou arraste uma imagem para o círculo."}
          </DialogDescription>
        </DialogHeader>

        <input
          ref={input}
          type="file"
          accept={AVATAR_ACCEPT}
          className="hidden"
          onChange={(event) => {
            void choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <div className="grid justify-items-center gap-4 py-1">
          <div
            role={picked ? "img" : undefined}
            aria-label={picked ? "Recorte da foto. Use as setas para mover." : undefined}
            tabIndex={picked ? 0 : -1}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onWheel={(event) => zoomTo(zoom - event.deltaY * 0.002)}
            onDragOver={(event) => {
              event.preventDefault();
              setDropping(true);
            }}
            onDragLeave={() => setDropping(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDropping(false);
              void choose(event.dataTransfer.files[0]);
            }}
            className={cn(
              "relative touch-none overflow-hidden rounded-full bg-secondary outline-none select-none",
              "ring-offset-2 ring-offset-popover focus-visible:ring-2 focus-visible:ring-ring",
              picked ? "cursor-grab active:cursor-grabbing" : "",
              dropping ? "ring-2 ring-primary" : "",
            )}
            style={{ width: FRAME, height: FRAME }}
          >
            {picked ? (
              <img
                src={picked.url}
                alt=""
                draggable={false}
                className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
                style={{
                  width: picked.image.width,
                  height: picked.image.height,
                  transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="press grid size-full place-items-center rounded-full"
                aria-label="Escolher foto"
              >
                <Avatar name={name} src={current} size={FRAME} />
              </button>
            )}
          </div>

          {picked ? (
            <div className="flex w-full max-w-[240px] items-center gap-2.5 text-muted-foreground">
              <ImageIcon className="size-3.5 shrink-0" />
              <input
                type="range"
                aria-label="Zoom"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(event) => zoomTo(Number(event.target.value))}
                className="h-1 min-w-0 flex-1 cursor-pointer accent-primary"
              />
              <ImageIcon className="size-5 shrink-0" />
            </div>
          ) : null}

          <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
            <ImageUpIcon />
            {picked ? "Escolher outra…" : "Escolher foto…"}
          </Button>
        </div>

        <DialogFooter className="sm:justify-between">
          {current && !picked ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={saving}
              onClick={() => onSave(null)}
            >
              Remover foto
            </Button>
          ) : (
            <span aria-hidden />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={!picked || saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
