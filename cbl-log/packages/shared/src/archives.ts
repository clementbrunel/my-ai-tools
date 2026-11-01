// Archive name patterns of a rolled log (T-08): shared by the engine (which lists the archives) and the
// app (which learns a pattern from an archive the user points at).

import { escapeRegExp } from "./pattern.js";

const baseName = (path: string): string => path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);

/**
 * Pattern learned from one archive shown by the user: the parts its name shares with the live file
 * are kept as is, the variable part becomes a template where digit runs match any digits.
 * `SystemOut.log` + `SystemOut_26.10.21_09.30.46.log` → `SystemOut_\d+\.\d+\.\d+_\d+\.\d+\.\d+\.log`.
 */
export function learnArchivePattern(livePath: string, archivePath: string): string {
  const live = baseName(livePath);
  const archive = baseName(archivePath);
  if (live === archive) throw new Error("L'archive doit être un autre fichier que le fichier suivi");
  let prefix = 0;
  while (prefix < live.length && prefix < archive.length && live[prefix] === archive[prefix]) prefix++;
  let suffix = 0;
  const room = Math.min(live.length, archive.length) - prefix;
  while (suffix < room && live[live.length - 1 - suffix] === archive[archive.length - 1 - suffix]) suffix++;
  const middle = archive.slice(prefix, archive.length - suffix);
  if (!/\d/.test(middle)) throw new Error("Le nom de l'archive ne contient ni date ni numéro qui le distingue du fichier suivi");
  const template = middle
    .split(/(\d+)/)
    .map((part, i) => (i % 2 === 1 ? "\\d+" : escapeRegExp(part)))
    .join("");
  return escapeRegExp(archive.slice(0, prefix)) + template + escapeRegExp(archive.slice(archive.length - suffix));
}
