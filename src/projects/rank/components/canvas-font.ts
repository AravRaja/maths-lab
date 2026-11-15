/** The page's Archivo family for canvas text (next/font gives it a generated name). */
let cached: string | null = null;
export function family(): string {
  if (cached) return cached;
  if (typeof document === "undefined") return "system-ui, sans-serif";
  cached = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  return cached;
}

export function font(ctx: CanvasRenderingContext2D, px: number, weight = 600, stretch: "condensed" | "normal" | "expanded" | "ultra-expanded" = "normal") {
  ctx.font = `${weight} ${px}px ${family()}`;
  try {
    (ctx as CanvasRenderingContext2D & { fontStretch?: string }).fontStretch = stretch;
  } catch {
    /* older browsers */
  }
}
