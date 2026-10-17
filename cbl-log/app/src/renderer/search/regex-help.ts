// Help for people who do not write regular expressions every day: building blocks to insert,
// ready-made patterns, and a plain-French reading of what a pattern means.

export interface Snippet {
  label: string;
  /** Text inserted at the cursor. */
  insert: string;
  description: string;
}

export interface Preset {
  label: string;
  pattern: string;
  /** A line that matches, to show what the pattern is for. */
  example: string;
}

export const SNIPPETS: readonly Snippet[] = [
  { label: "un chiffre", insert: "\\d", description: "un caractère entre 0 et 9" },
  { label: "des chiffres", insert: "\\d+", description: "un ou plusieurs chiffres à la suite" },
  { label: "un mot", insert: "\\w+", description: "des lettres, chiffres ou _ à la suite" },
  { label: "n'importe quoi", insert: ".*", description: "n'importe quels caractères (même aucun)" },
  { label: "un espace", insert: "\\s+", description: "un ou plusieurs espaces ou tabulations" },
  { label: "début de ligne", insert: "^", description: "le motif doit commencer la ligne" },
  { label: "fin de ligne", insert: "$", description: "le motif doit finir la ligne" },
  { label: "mot entier", insert: "\\b", description: "frontière de mot : \\bERROR\\b ne trouve pas ERRORS" },
  { label: "l'un ou l'autre", insert: "(ERROR|WARN)", description: "ERROR ou WARN" },
  { label: "un caractère parmi", insert: "[abc]", description: "a, b ou c ; [0-9] pour un intervalle" },
  { label: "optionnel", insert: "?", description: "le caractère ou groupe précédent est facultatif" },
  { label: "répété n fois", insert: "{3}", description: "le précédent exactement 3 fois ({2,5} : de 2 à 5)" },
  { label: "un point", insert: "\\.", description: "un vrai point (le . seul veut dire « n'importe quoi »)" },
];

export const PRESETS: readonly Preset[] = [
  { label: "Adresse IP", pattern: "\\b\\d{1,3}(\\.\\d{1,3}){3}\\b", example: "client 192.168.0.12 connected" },
  { label: "Date AAAA-MM-JJ", pattern: "\\d{4}-\\d{2}-\\d{2}", example: "2026-10-18 started" },
  { label: "Heure hh:mm:ss", pattern: "\\b\\d{2}:\\d{2}:\\d{2}\\b", example: "at 10:02:11 done" },
  { label: "Nombre", pattern: "-?\\d+(\\.\\d+)?", example: "took 12.5 ms" },
  { label: "Identifiant UUID", pattern: "[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}", example: "id 123e4567-e89b-12d3-a456-426614174000" },
  { label: "Exception Java", pattern: "\\b[\\w.$]+Exception\\b", example: "java.lang.NullPointerException: x" },
  { label: "Message IBM en erreur (…E)", pattern: "\\b[A-Z]{4,5}\\d{4}E\\b", example: "SESN0066E: session lost" },
  { label: "URL", pattern: "https?://\\S+", example: "GET https://example.org/a?b=1" },
  { label: "Adresse e-mail", pattern: "[\\w.+-]+@[\\w-]+\\.[\\w.-]+", example: "contact a.b@example.org" },
  { label: "Ligne vide", pattern: "^\\s*$", example: "" },
];

/** `value` with `insert` put in place of the selection; returns the new text and cursor position. */
export function insertAt(value: string, start: number, end: number, insert: string): { value: string; cursor: number } {
  const from = Math.max(0, Math.min(start, value.length));
  const to = Math.max(from, Math.min(end, value.length));
  // keep the cursor inside a pair of delimiters, ready to type: (…) […] {…}
  const inside = /^[([{].*[)\]}]$/.test(insert) && insert.length > 2 ? 1 : 0;
  const text = value.slice(0, from) + insert + value.slice(to);
  return { value: text, cursor: from + (inside ? 1 : insert.length) };
}

// -------------------------------------------------------------------------------------------------

export interface Explained {
  token: string;
  meaning: string;
}

const CLASS_NAMES: Record<string, string> = {
  d: "un chiffre",
  D: "un caractère qui n'est pas un chiffre",
  w: "une lettre, un chiffre ou _",
  W: "un caractère qui n'est ni lettre, ni chiffre, ni _",
  s: "un espace ou une tabulation",
  S: "un caractère qui n'est pas un espace",
  b: "une frontière de mot",
  B: "pas une frontière de mot",
  n: "un saut de ligne",
  t: "une tabulation",
};

function quantifier(text: string, at: number): { token: string; meaning: string; length: number } | undefined {
  const c = text[at];
  let token: string;
  let meaning: string;
  if (c === "*") [token, meaning] = ["*", "répété 0 fois ou plus"];
  else if (c === "+") [token, meaning] = ["+", "répété 1 fois ou plus"];
  else if (c === "?") [token, meaning] = ["?", "facultatif (0 ou 1 fois)"];
  else if (c === "{") {
    const m = /^\{(\d+)(,(\d*))?\}/.exec(text.slice(at));
    if (!m) return undefined;
    token = m[0];
    if (m[2] === undefined) meaning = `répété exactement ${m[1]} fois`;
    else if (m[3] === "") meaning = `répété ${m[1]} fois ou plus`;
    else meaning = `répété de ${m[1]} à ${m[3]} fois`;
  } else return undefined;
  let length = token.length;
  if (text[at + length] === "?" && c !== "?") {
    token += "?";
    meaning += ", le plus court possible";
    length++;
  }
  return { token, meaning, length };
}

/**
 * A short plain-French reading of a pattern, token by token. Not a full regex parser: it covers what
 * people actually type (classes, groups, anchors, quantifiers, alternatives, literals).
 */
export function explain(pattern: string): Explained[] {
  const out: Explained[] = [];
  let literal = "";
  const flush = (): void => {
    if (literal) out.push({ token: literal, meaning: literal.length === 1 ? `le caractère « ${literal} »` : `le texte « ${literal} »` });
    literal = "";
  };
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i]!;
    const q = quantifier(pattern, i);
    if (q && (c === "*" || c === "+" || c === "?" || c === "{")) {
      // a quantifier applies to the thing just before it: do not merge that thing into a literal run
      if (literal.length > 1) {
        const last = literal.slice(-1);
        literal = literal.slice(0, -1);
        flush();
        literal = last;
      }
      flush();
      out.push({ token: q.token, meaning: q.meaning });
      i += q.length;
      continue;
    }
    if (c === "\\" && i + 1 < pattern.length) {
      flush();
      const n = pattern[i + 1]!;
      out.push({
        token: `\\${n}`,
        meaning: CLASS_NAMES[n] ?? (/[.*+?^${}()|[\]\\/-]/.test(n) ? `le caractère « ${n} » lui-même` : `le caractère « ${n} »`),
      });
      i += 2;
    } else if (c === "[") {
      flush();
      const end = pattern.indexOf("]", i + 2);
      const body = end === -1 ? pattern.slice(i) : pattern.slice(i, end + 1);
      const negated = body[1] === "^";
      out.push({ token: body, meaning: `${negated ? "un caractère qui n'est pas parmi" : "un caractère parmi"} ${body.slice(negated ? 2 : 1, end === -1 ? undefined : -1)}` });
      i += body.length;
    } else if (c === "(") {
      flush();
      const named = /^\(\?<([A-Za-z_]\w*)>/.exec(pattern.slice(i));
      if (named) {
        out.push({ token: named[0], meaning: `début du groupe nommé « ${named[1]} »` });
        i += named[0].length;
      } else if (pattern.startsWith("(?:", i)) {
        out.push({ token: "(?:", meaning: "début d'un groupe (sans mémoriser)" });
        i += 3;
      } else if (pattern.startsWith("(?=", i) || pattern.startsWith("(?!", i)) {
        out.push({ token: pattern.slice(i, i + 3), meaning: pattern[i + 2] === "=" ? "suivi de (sans le consommer)" : "pas suivi de" });
        i += 3;
      } else {
        out.push({ token: "(", meaning: "début d'un groupe" });
        i++;
      }
    } else if (c === ")") {
      flush();
      out.push({ token: ")", meaning: "fin du groupe" });
      i++;
    } else if (c === "|") {
      flush();
      out.push({ token: "|", meaning: "ou bien" });
      i++;
    } else if (c === "^") {
      flush();
      out.push({ token: "^", meaning: "début de la ligne" });
      i++;
    } else if (c === "$") {
      flush();
      out.push({ token: "$", meaning: "fin de la ligne" });
      i++;
    } else if (c === ".") {
      flush();
      out.push({ token: ".", meaning: "n'importe quel caractère" });
      i++;
    } else {
      literal += c;
      i++;
    }
  }
  flush();
  return out;
}
