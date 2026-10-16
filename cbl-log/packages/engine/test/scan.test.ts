import { describe, expect, it } from "vitest";
import { scanChunk, type Encoding, type ScanCarry } from "../src/index";
import { encode, mulberry32 } from "./gen";

function scanWhole(buf: Buffer, enc: Encoding): { starts: number[]; terms: number[]; carry: ScanCarry } {
  const starts: number[] = [];
  const terms: number[] = [];
  const carry: ScanCarry = { pendingCR: false };
  scanChunk(buf, 0, enc, carry, (n, t) => {
    starts.push(n);
    terms.push(t);
  });
  return { starts, terms, carry };
}

function scanSplit(buf: Buffer, enc: Encoding, cuts: number[]): number[] {
  const starts: number[] = [];
  const carry: ScanCarry = { pendingCR: false };
  let at = 0;
  for (const end of [...cuts, buf.length]) {
    const consumed = scanChunk(buf.subarray(at, end), at, enc, carry, (n) => {
      starts.push(n);
    });
    at += consumed;
  }
  return starts;
}

describe("scanChunk", () => {
  it("LF, CRLF, CR seul", () => {
    const { starts, terms } = scanWhole(Buffer.from("a\nb\r\nc\rd"), "utf-8");
    expect(starts).toEqual([2, 5, 7]);
    expect(terms).toEqual([1, 2, 1]);
  });

  it("\\r en fin de chunk reste en attente, \\r\\n coupe = un seul terminateur", () => {
    const starts: number[] = [];
    const carry: ScanCarry = { pendingCR: false };
    const a = Buffer.from("ab\r");
    const b = Buffer.from("\ncd\r");
    const c = Buffer.from("ef");
    let at = 0;
    for (const chunk of [a, b, c]) at += scanChunk(chunk, at, "utf-8", carry, (n) => void starts.push(n));
    expect(starts).toEqual([4, 7]);
    expect(carry.pendingCR).toBe(false);
  });

  it("CR en attente puis autre octet : fin de ligne a l'offset du CR + 1", () => {
    const starts: number[] = [];
    const carry: ScanCarry = { pendingCR: false };
    scanChunk(Buffer.from("a\r"), 0, "utf-8", carry, (n) => void starts.push(n));
    expect(carry.pendingCR).toBe(true);
    expect(starts).toEqual([]);
    scanChunk(Buffer.from("b"), 2, "utf-8", carry, (n) => void starts.push(n));
    expect(starts).toEqual([2]);
  });

  it("le handler peut arreter le scan", () => {
    const carry: ScanCarry = { pendingCR: false };
    const consumed = scanChunk(Buffer.from("a\nb\nc\n"), 0, "utf-8", carry, (n) => n === 4);
    expect(consumed).toBe(4);
  });

  it("UTF-16 : seuls les 0x0a alignes comptent", () => {
    // U+0A41 en LE = 41 0A (le 0x0a est en position impaire) ; U+0A00 = 00 0A
    const le = encode("xੁ਀\ny\r\nz", "utf-16le");
    expect(scanWhole(le, "utf-16le").starts).toEqual([8, 14]);
    const be = encode("xੁ਀\ny\r\nz", "utf-16be");
    expect(scanWhole(be, "utf-16be").starts).toEqual([8, 14]);
  });

  it("UTF-16 : octet impair final ignore", () => {
    const buf = Buffer.concat([encode("a\n", "utf-16le"), Buffer.from([0x62])]);
    const carry: ScanCarry = { pendingCR: false };
    expect(scanChunk(buf, 0, "utf-16le", carry, () => {})).toBe(4);
  });

  it.each<Encoding>(["utf-8", "utf-16le", "utf-16be"])("indifferent au decoupage en chunks (%s)", (enc) => {
    const rand = mulberry32(42);
    for (let iter = 0; iter < 50; iter++) {
      let s = "";
      for (let i = 0; i < 200; i++) s += ["a", "\n", "\r", "\r\n", "bc", "ੁ"][Math.floor(rand() * 6)];
      const buf = encode(s, enc);
      const unit = enc === "utf-8" ? 1 : 2;
      const expected = scanWhole(buf, enc).starts;
      const cuts: number[] = [];
      for (let at = 0; ; ) {
        at += (1 + Math.floor(rand() * 9)) * unit;
        if (at >= buf.length) break;
        cuts.push(at);
      }
      expect(scanSplit(buf, enc, cuts)).toEqual(expected);
    }
  });
});
