import { describe, expect, it } from "vitest";
import { isInstalled } from "./installed-fonts";

describe("isInstalled", () => {
  // fake metrics: only "Consolas" has widths of its own
  const measure = (font: string): number => (font.includes('"Consolas"') ? 100 : font.includes("serif") ? 120 : 110);

  it("finds a font whose text differs from the fallbacks", () => {
    expect(isInstalled("Consolas", measure)).toBe(true);
  });

  it("rejects a font drawn with the fallbacks", () => {
    expect(isInstalled("Missing Mono", measure)).toBe(false);
  });
});
