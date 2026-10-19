import { describe, expect, it } from "vitest";
import { assetName, compareVersions, expectedSha256, findUpdate, type GitHubRelease } from "./update-check";

const release = (tag: string, opts: Partial<GitHubRelease> = {}): GitHubRelease => {
  const version = tag.replace(/^cbl-log-v/, "");
  return {
    tag_name: tag,
    html_url: `https://github.com/x/y/releases/tag/${tag}`,
    body: `notes ${version}`,
    draft: false,
    prerelease: false,
    assets: [
      { name: assetName("setup", version), size: 10, browser_download_url: `https://dl/${version}/setup` },
      { name: assetName("portable", version), size: 20, browser_download_url: `https://dl/${version}/portable` },
    ],
    ...opts,
  };
};

describe("compareVersions", () => {
  it("compares numerically, not lexically", () => {
    expect(compareVersions("1.0.10", "1.0.9")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.10.0")).toBeLessThan(0);
    expect(compareVersions("2.0.0", "2.0.0")).toBe(0);
  });

  it("sorts unparsable versions lowest", () => {
    expect(compareVersions("1.0.0-beta", "0.0.1")).toBeLessThan(0);
  });
});

describe("findUpdate", () => {
  it("offers the newest cbl-log release newer than the current one", () => {
    const releases = [release("cbl-log-v1.0.2"), release("cbl-log-v1.1.0"), release("cbl-log-v1.0.1")];
    const update = findUpdate(releases, "1.0.1", "setup");
    expect(update?.version).toBe("1.1.0");
    expect(update?.asset.name).toBe("cbl-log-Setup-1.1.0.exe");
    expect(update?.notes).toBe("notes 1.1.0");
  });

  it("returns nothing when up to date", () => {
    expect(findUpdate([release("cbl-log-v1.0.1"), release("cbl-log-v1.0.0")], "1.0.1", "setup")).toBeUndefined();
  });

  it("ignores other tools of the monorepo, drafts and pre-releases", () => {
    const releases = [
      release("ai-env-manager-v9.0.0"),
      release("cbl-log-v3.0.0", { draft: true }),
      release("cbl-log-v2.0.0", { prerelease: true }),
      release("cbl-log-v1.5.0-rc1"),
    ];
    expect(findUpdate(releases, "1.0.0", "setup")).toBeUndefined();
  });

  it("picks the asset of the running flavour and skips a release missing it", () => {
    expect(findUpdate([release("cbl-log-v1.2.0")], "1.0.0", "portable")?.asset.name).toBe("cbl-log-1.2.0-portable.exe");
    const noPortable = release("cbl-log-v1.3.0", { assets: [release("cbl-log-v1.3.0").assets[0]!] });
    expect(findUpdate([noPortable, release("cbl-log-v1.2.0")], "1.0.0", "portable")?.version).toBe("1.2.0");
  });
});

describe("expectedSha256", () => {
  it("reads GitHub's sha256 digest and ignores anything else", () => {
    const hex = "a".repeat(64);
    expect(expectedSha256({ name: "x", size: 1, browser_download_url: "", digest: `sha256:${hex}` })).toBe(hex);
    expect(expectedSha256({ name: "x", size: 1, browser_download_url: "", digest: null })).toBeUndefined();
    expect(expectedSha256({ name: "x", size: 1, browser_download_url: "" })).toBeUndefined();
  });
});
