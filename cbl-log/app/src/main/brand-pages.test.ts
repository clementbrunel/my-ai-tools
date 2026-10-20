import { describe, expect, it } from "vitest";
import { aboutHtml, AUTHOR_URL, splashHtml } from "./brand-pages";

const avatar = "data:image/png;base64,AAAA";

describe("splashHtml", () => {
  it("shows the app name, a spinner, the version and the avatar", () => {
    const html = splashHtml("1.1.0", false, avatar);
    expect(html).toContain("<h1>cbl-log</h1>");
    expect(html).toContain('class="spinner"');
    expect(html).toContain("v1.1.0");
    expect(html).toContain(`src="${avatar}"`);
  });

  it("omits the avatar when it is unavailable", () => {
    expect(splashHtml("1.1.0", false)).not.toContain("<img");
  });

  it("follows the theme", () => {
    expect(splashHtml("1.0.0", false)).toContain("background: #ffffff");
    expect(splashHtml("1.0.0", true)).toContain("background: #14171a");
  });

  it("escapes the version", () => {
    expect(splashHtml("<b>", false)).toContain("v&lt;b&gt;");
  });
});

describe("aboutHtml", () => {
  it("shows the version, the avatar and a link to the author's GitHub", () => {
    const html = aboutHtml("1.2.0", true, avatar);
    expect(html).toContain("Version 1.2.0");
    expect(html).toContain(`src="${avatar}"`);
    expect(html).toContain(`href="${AUTHOR_URL}"`);
  });
});
