import { describe, expect, it } from "vitest";
import { splashHtml } from "./splash-page";

describe("splashHtml", () => {
  it("shows the app name, a spinner and the version", () => {
    const html = splashHtml("1.1.0", false);
    expect(html).toContain("<h1>cbl-log</h1>");
    expect(html).toContain('class="spinner"');
    expect(html).toContain("v1.1.0");
  });

  it("follows the theme", () => {
    expect(splashHtml("1.0.0", false)).toContain("background: #ffffff");
    expect(splashHtml("1.0.0", true)).toContain("background: #14171a");
  });

  it("escapes the version", () => {
    expect(splashHtml("<b>", false)).toContain("v&lt;b&gt;");
  });
});
