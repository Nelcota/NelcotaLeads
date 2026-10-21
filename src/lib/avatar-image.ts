const AVATAR_SIZE = 256;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const AVATAR_ACCEPT = ACCEPTED.join(",");

/** The visible square of the photo, in the photo's own pixels. */
export type AvatarCrop = { x: number; y: number; side: number };

/** Opens a picked or dropped file as an image the editor can pan and zoom. */
export async function loadAvatarImage(file: File): Promise<ImageBitmap> {
  if (!ACCEPTED.includes(file.type)) throw new Error("Escolha uma imagem JPG, PNG, WebP ou GIF.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("Não foi possível abrir essa imagem.");
  return bitmap;
}

/** Draws the cropped square into a small JPEG data URL, the format the server stores. */
export function renderAvatar(image: ImageBitmap, crop: AvatarCrop): string {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível processar a imagem.");
  context.imageSmoothingQuality = "high";
  // JPEG has no transparency: a transparent PNG would come out with a black background.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  context.drawImage(image, crop.x, crop.y, crop.side, crop.side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  return canvas.toDataURL("image/jpeg", 0.86);
}
