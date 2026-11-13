/** Brings a section to the top of the view; without the glide for people who asked for less motion. */
export function scrollToSection(id: string): void {
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
}
