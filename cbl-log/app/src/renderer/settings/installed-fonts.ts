// Monospaced fonts actually installed on this computer, for the "Police" drop-down list. A font is
// installed when text drawn with it differs from the generic fallbacks (no permission needed, unlike
// queryLocalFonts); candidates are the usual monospaced fonts of Windows and of developers.
export const MONOSPACE_CANDIDATES = [
  "Consolas",
  "Cascadia Mono",
  "Cascadia Code",
  "Lucida Console",
  "Courier New",
  "JetBrains Mono",
  "Fira Code",
  "Fira Mono",
  "Source Code Pro",
  "Hack",
  "IBM Plex Mono",
  "Roboto Mono",
  "Ubuntu Mono",
  "DejaVu Sans Mono",
  "Inconsolata",
  "Lucida Sans Typewriter",
] as const;

const SAMPLE = "mmmmmmmmmmlliWWW@#0123";

/** Whether `measure(font)` tells `family` apart from both generic fallbacks. */
export function isInstalled(family: string, measure: (font: string) => number): boolean {
  return ["monospace", "serif"].some((generic) => measure(`16px "${family}", ${generic}`) !== measure(`16px ${generic}`));
}

let cached: string[] | undefined;

/** Installed candidates, in the list's order (measured once per window). */
export function installedMonospaceFonts(): string[] {
  if (cached) return cached;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return [...MONOSPACE_CANDIDATES];
  const measure = (font: string): number => {
    ctx.font = font;
    return ctx.measureText(SAMPLE).width;
  };
  cached = MONOSPACE_CANDIDATES.filter((f) => isInstalled(f, measure));
  return cached;
}
