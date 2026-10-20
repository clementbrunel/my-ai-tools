import { describe, expect, it } from "vitest";
import { bomLength, createDecoder, detectEncoding, looksBinary } from "../src/index";

const utf16le = (s: string, bom = false) => Buffer.concat([bom ? Buffer.from([0xff, 0xfe]) : Buffer.alloc(0), Buffer.from(s, "utf16le")]);
const utf16be = (s: string, bom = false) => {
  const b = Buffer.from(s, "utf16le").swap16();
  return Buffer.concat([bom ? Buffer.from([0xfe, 0xff]) : Buffer.alloc(0), b]);
};

describe("detectEncoding", () => {
  it("BOM UTF-8", () => expect(detectEncoding(Buffer.from([0xef, 0xbb, 0xbf, 0x61]))).toBe("utf-8"));
  it("BOM UTF-16LE", () => expect(detectEncoding(utf16le("hello", true))).toBe("utf-16le"));
  it("BOM UTF-16BE", () => expect(detectEncoding(utf16be("hello", true))).toBe("utf-16be"));
  it("valid UTF-8 without BOM", () => expect(detectEncoding(Buffer.from("héllo wörld ✓"))).toBe("utf-8"));
  it("pure ASCII => utf-8", () => expect(detectEncoding(Buffer.from("plain ascii"))).toBe("utf-8"));
  it("empty => utf-8", () => expect(detectEncoding(Buffer.alloc(0))).toBe("utf-8"));
  it("invalid UTF-8 bytes => windows-1252", () => {
    expect(detectEncoding(Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x20, 0x74, 0xf4, 0x74]))).toBe("windows-1252");
  });
  it("UTF-8 sequence cut at the end of the sample stays utf-8", () => {
    const full = Buffer.from("abc€");
    expect(detectEncoding(full.subarray(0, full.length - 1))).toBe("utf-8");
  });
  it("UTF-16LE without BOM (heuristic)", () => expect(detectEncoding(utf16le("2026-10-14 INFO started"))).toBe("utf-16le"));
  it("UTF-16BE without BOM (heuristic)", () => expect(detectEncoding(utf16be("2026-10-14 INFO started"))).toBe("utf-16be"));
});

describe("bomLength / decoder", () => {
  it("BOM lengths", () => {
    expect(bomLength("utf-8", Buffer.from([0xef, 0xbb, 0xbf, 1]))).toBe(3);
    expect(bomLength("utf-16le", utf16le("a", true))).toBe(2);
    expect(bomLength("utf-16be", utf16be("a", true))).toBe(2);
    expect(bomLength("utf-16le", utf16be("a", true))).toBe(0);
    expect(bomLength("windows-1252", Buffer.from([0xef, 0xbb, 0xbf]))).toBe(0);
  });

  it("decodes each encoding", () => {
    expect(createDecoder("utf-8").decode(Buffer.from("é✓"))).toBe("é✓");
    expect(createDecoder("utf-16le").decode(utf16le("é✓"))).toBe("é✓");
    expect(createDecoder("utf-16be").decode(utf16be("é✓"))).toBe("é✓");
    expect(createDecoder("windows-1252").decode(Buffer.from([0xe9, 0x80]))).toBe("é€");
    expect(createDecoder("iso-8859-1").decode(Buffer.from([0xe9]))).toBe("é");
  });
});

describe("looksBinary", () => {
  it("NUL => binary", () => expect(looksBinary(Buffer.from([0x61, 0, 0x62]))).toBe(true));
  it("text => no", () => expect(looksBinary(Buffer.from("text"))).toBe(false));
});
