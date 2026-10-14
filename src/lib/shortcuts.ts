/** Keyboard shortcuts of the app, for tooltips and the help screen. */
export const SHORTCUTS = [
  { keys: ["J"], label: "Próxima conversa ou próximo lead" },
  { keys: ["K"], label: "Conversa ou lead anterior" },
  { keys: ["Esc"], label: "Fechar a conversa (celular)" },
  { keys: ["Mod", "Enter"], label: "Enviar a resposta" },
] as const;

let apple: boolean | undefined;

/** Mac, iPhone or iPad: ⌘ instead of Ctrl. Read once; false on the server. */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  if (apple === undefined) {
    const nav: Navigator & { userAgentData?: { platform?: string } } = navigator;
    apple = /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform || nav.platform || "");
  }
  return apple;
}

/** "⌘↵" on Apple systems, "Ctrl+Enter" elsewhere. */
export function sendShortcut(appleKeys = isApplePlatform()): string {
  return appleKeys ? "⌘↵" : "Ctrl+Enter";
}

/** ⌘/Ctrl + Enter, the "send" chord of text fields. */
export function isSendChord(event: { key: string; metaKey: boolean; ctrlKey: boolean }) {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}

/** Focus is where the user types, so single-key shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
      target.closest("[role=listbox]") !== null)
  );
}
