// Documentation of settings.json for the "Configuration" window: one entry per setting (label, explanation,
// control, when it applies), plus the helpers shared by its two modes (form and raw JSON).
// The schema (config.ts) stays the reference for validation; this file only describes it to the user.
import { applyMigrations, defaultSettings, MAX_FONT_SIZE, MIN_FONT_SIZE, settingsSchema, type Settings } from "./config.js";

/** When a change is taken into account. */
export type SettingApply = "live" | "next-open" | "restart";

export type SettingControl =
  | { kind: "boolean" }
  | { kind: "enum"; options: readonly { value: string; label: string }[] }
  | { kind: "number"; min: number; max: number; step?: number; unit?: string }
  /**
   * Optional text: an empty field removes the key (the default behaviour then applies).
   * `suggestions` are offered in a drop-down list (any other value can still be typed);
   * `emptyLabel` is how the absent value is shown ("(automatique)" by default).
   */
  | { kind: "text"; placeholder?: string; suggestions?: readonly string[]; emptyLabel?: string }
  /** Several values among `options` (at least one), shown as check boxes. */
  | { kind: "flags"; options: readonly { value: string; label: string }[] }
  /** Map edited as a list (entries can only be removed). */
  | { kind: "map" };

export interface SettingDoc {
  /** Path of the key in settings.json: ["docker", "initialTail"]. */
  path: readonly string[];
  label: string;
  description: string;
  control: SettingControl;
  apply: SettingApply;
}

export interface SettingSection {
  id: string;
  title: string;
  settings: readonly SettingDoc[];
}

export const SETTING_SECTIONS: readonly SettingSection[] = [
  {
    id: "general",
    title: "Général",
    settings: [
      {
        path: ["theme"],
        label: "Thème",
        description: "Couleurs de l'interface. « Système » suit le réglage de Windows ; le bouton soleil / lune de la barre d'état choisit clair ou sombre.",
        control: {
          kind: "enum",
          options: [
            { value: "system", label: "Système" },
            { value: "light", label: "Clair" },
            { value: "dark", label: "Sombre" },
          ],
        },
        apply: "live",
      },
      {
        path: ["checkForUpdates"],
        label: "Rechercher les mises à jour",
        description:
          "Vérifie au démarrage puis toutes les heures si une nouvelle version est publiée sur GitHub. C'est le seul accès réseau de l'application (une requête GET vers api.github.com, rien n'est envoyé). « Aide › Rechercher une mise à jour… » reste disponible si c'est désactivé.",
        control: { kind: "boolean" },
        apply: "live",
      },
      {
        path: ["restoreSession"],
        label: "Rouvrir les onglets au démarrage",
        description:
          "Au lancement, rouvre les fichiers de la dernière session avec leur position, leur filtre et leur nom. Désactivé, cbl-log démarre sur l'écran d'accueil.",
        control: { kind: "boolean" },
        apply: "restart",
      },
      {
        path: ["confirmCloseTabs"],
        label: "Confirmer la fermeture de plusieurs onglets",
        description: "Demande confirmation avant « Fermer les autres onglets », « Fermer les onglets à droite » ou « Fermer tous les onglets » (clic droit sur un onglet).",
        control: { kind: "boolean" },
        apply: "live",
      },
    ],
  },
  {
    id: "viewer",
    title: "Affichage des logs",
    settings: [
      {
        path: ["viewer", "fontFamily"],
        label: "Police",
        description:
          "Police des lignes de log. Choisissez-en une à espacement fixe pour garder les colonnes alignées. Une police absente de ce poste est remplacée par Consolas. Vide : Consolas.",
        control: {
          kind: "text",
          placeholder: "Consolas",
          emptyLabel: "Consolas",
          suggestions: ["Consolas", "Cascadia Mono", "Cascadia Code", "Lucida Console", "Courier New", "JetBrains Mono", "Fira Code", "Source Code Pro"],
        },
        apply: "live",
      },
      {
        path: ["viewer", "fontSize"],
        label: "Taille du texte",
        description:
          "Taille des caractères des lignes de log ; la hauteur des lignes suit. Le zoom (Ctrl+molette) agrandit en plus toute la fenêtre.",
        control: { kind: "number", min: MIN_FONT_SIZE, max: MAX_FONT_SIZE, step: 1, unit: "px" },
        apply: "live",
      },
      {
        path: ["viewer", "showLineNumbers"],
        label: "Numéros de ligne",
        description:
          "Affiche le numéro de chaque ligne dans la marge de gauche. Masqués, la marge ne garde que le niveau (et la source dans l'onglet « Tout ») ; « Copier avec numéros » et Ctrl+G restent disponibles.",
        control: { kind: "boolean" },
        apply: "live",
      },
    ],
  },
  {
    id: "tabs",
    title: "Nouveaux onglets",
    settings: [
      {
        path: ["tabs", "followOnOpen"],
        label: "Suivre à l'ouverture",
        description:
          "Un fichier ouvert affiche sa fin et suit les nouvelles lignes. Désactivé, il s'ouvre au début du fichier, sans suivi (le bouton Suivre le réactive). Les onglets restaurés au démarrage gardent leur état.",
        control: { kind: "boolean" },
        apply: "next-open",
      },
      {
        path: ["tabs", "foldTraces"],
        label: "Replier les stack traces",
        description: "Les lignes de suite (stack traces, SQL sur plusieurs lignes…) sont repliées sous leur enregistrement dès l'ouverture, quand le format est reconnu.",
        control: { kind: "boolean" },
        apply: "next-open",
      },
      {
        path: ["tabs", "levels"],
        label: "Niveaux affichés",
        description:
          "Niveaux visibles à l'ouverture d'un fichier dont le format est reconnu ; les autres sont filtrés (les pastilles de niveau les réaffichent). Par exemple, décocher DEBUG et TRACE.",
        control: {
          kind: "flags",
          options: [
            { value: "fatal", label: "FATAL" },
            { value: "error", label: "ERROR" },
            { value: "warn", label: "WARN" },
            { value: "info", label: "INFO" },
            { value: "debug", label: "DEBUG" },
            { value: "trace", label: "TRACE" },
          ],
        },
        apply: "next-open",
      },
    ],
  },
  {
    id: "history",
    title: "Historique des fichiers (rolling)",
    settings: [
      {
        path: ["historyHours"],
        label: "Durée d'historique",
        description:
          "À l'ouverture d'un fichier, ses archives de rotation (app.log.1, app-2026-11-03.log…) modifiées depuis moins de ce nombre d'heures sont chargées avant lui. 0 = le fichier seul.",
        control: { kind: "number", min: 0, max: 720, step: 1, unit: "h" },
        apply: "next-open",
      },
      {
        path: ["archivePatterns"],
        label: "Motifs d'archives appris",
        description:
          "Noms d'archives appris par fichier avec le clic droit sur le chemin › « Désigner une archive du rolling… ». Supprimer une entrée revient à la détection automatique.",
        control: { kind: "map" },
        apply: "next-open",
      },
    ],
  },
  {
    id: "docker",
    title: "Docker",
    settings: [
      {
        path: ["docker", "enabled"],
        label: "Conteneurs Docker",
        description: "Affiche le bouton et le panneau Docker (Ctrl+Maj+D) et dialogue avec le démon Docker Desktop.",
        control: { kind: "boolean" },
        apply: "live",
      },
      {
        path: ["docker", "host"],
        label: "Adresse du démon",
        description:
          "Adresse du démon Docker (npipe://…, tcp://…). Vide : variable DOCKER_HOST, puis le contexte Docker courant, puis le pipe de Docker Desktop.",
        control: { kind: "text", placeholder: "tcp://127.0.0.1:2375" },
        apply: "restart",
      },
      {
        path: ["docker", "initialTail"],
        label: "Lignes chargées à l'ouverture",
        description: "Nombre de dernières lignes lues quand un conteneur est ouvert. « Charger plus d'historique » remonte ensuite ×10.",
        control: { kind: "number", min: 1, max: 1_000_000, step: 1000, unit: "lignes" },
        apply: "next-open",
      },
      {
        path: ["docker", "spoolMaxMb"],
        label: "Taille max de la copie locale",
        description: "Les logs d'un conteneur sont copiés dans un fichier local ; au-delà de cette taille il est renouvelé.",
        control: { kind: "number", min: 1, max: 100_000, step: 64, unit: "Mo" },
        apply: "restart",
      },
      {
        path: ["docker", "keepSpoolOnClose"],
        label: "Conserver la copie locale à la fermeture",
        description: "Garde la copie locale des logs quand l'onglet est fermé (historique d'un conteneur supprimé). Sinon elle est effacée.",
        control: { kind: "boolean" },
        apply: "restart",
      },
    ],
  },
];

export const APPLY_LABELS: Readonly<Record<SettingApply, string>> = {
  live: "Immédiat",
  "next-open": "À la prochaine ouverture",
  restart: "Au prochain lancement",
};

export const settingKey = (path: readonly string[]): string => path.join(".");

/** Value at `path` (undefined when absent). */
export function getSetting(settings: Settings, path: readonly string[]): unknown {
  let value: unknown = settings;
  for (const key of path) {
    if (typeof value !== "object" || value === null) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/** Copy of `settings` with `path` set to `value`; undefined removes the key. */
export function setSetting(settings: Settings, path: readonly string[], value: unknown): Settings {
  const write = (target: unknown, depth: number): unknown => {
    const obj = typeof target === "object" && target !== null ? { ...(target as Record<string, unknown>) } : {};
    const key = path[depth]!;
    if (depth === path.length - 1) {
      if (value === undefined) delete obj[key];
      else obj[key] = value;
    } else {
      obj[key] = write(obj[key], depth + 1);
    }
    return obj;
  };
  return path.length === 0 ? settings : (write(settings, 0) as Settings);
}

/** Default value of a setting (from the schema defaults). */
export const defaultSetting = (path: readonly string[]): unknown => getSetting(defaultSettings(), path);

/** Text written for a settings value (same format as the app's own writes). */
export const settingsToText = (settings: Settings): string => `${JSON.stringify(settings, null, 2)}\n`;

export type SettingsTextCheck =
  | { ok: true; value: Settings; warnings: string[] }
  | { ok: false; errors: string[]; /** 1-based line of the first error, when it can be located. */ line?: number };

/** 1-based line of a character offset. */
function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Best-effort line of a key path in the JSON text: each segment is looked for after the previous one. */
export function lineOfPath(text: string, path: readonly PropertyKey[]): number | undefined {
  let from = 0;
  let found = -1;
  for (const segment of path) {
    if (typeof segment !== "string") continue;
    const re = new RegExp(`"${segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:`, "g");
    re.lastIndex = from;
    const m = re.exec(text);
    if (!m) break;
    found = m.index;
    from = m.index + m[0].length;
  }
  return found < 0 ? undefined : lineAt(text, found);
}

/** Offset of a JSON.parse error, from V8's "... at position N" / "(line L column C)" messages. */
function jsonErrorLine(text: string, message: string): number | undefined {
  const lc = /line (\d+) column \d+/.exec(message);
  if (lc) return Number(lc[1]);
  const pos = /position (\d+)/.exec(message);
  return pos ? lineAt(text, Number(pos[1])) : undefined;
}

interface IssueLike {
  code: string;
  path: readonly PropertyKey[];
  message: string;
  expected?: unknown;
  maximum?: unknown;
  minimum?: unknown;
  values?: readonly unknown[];
}

/** French wording of a schema issue (the zod message is kept as a fallback). */
function describeIssue(issue: IssueLike): string {
  const where = issue.path.length > 0 ? issue.path.map(String).join(".") : "(racine)";
  let what: string;
  switch (issue.code) {
    case "invalid_type":
      what = `type attendu : ${String(issue.expected)}`;
      break;
    case "too_big":
      what = `valeur maximale : ${String(issue.maximum)}`;
      break;
    case "too_small":
      what = `valeur minimale : ${String(issue.minimum)}`;
      break;
    case "invalid_value":
      what = issue.values ? `valeurs possibles : ${issue.values.map((v) => JSON.stringify(v)).join(", ")}` : issue.message;
      break;
    default:
      what = issue.message;
  }
  return `${where} — ${what}`;
}

/** Keys of `raw` the schema does not know (they would be silently dropped on the next save). */
function unknownKeys(raw: unknown): string[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
  const out: string[] = [];
  const top = settingsSchema.shape as Record<string, unknown>;
  for (const key of Object.keys(raw)) if (!(key in top)) out.push(key);
  // Nested groups (docker, viewer): their keys are the documented settings below them.
  const nested = SETTING_SECTIONS.flatMap((s) => s.settings).filter((s) => s.path.length === 2);
  for (const group of new Set(nested.map((s) => s.path[0]!))) {
    const value = (raw as Record<string, unknown>)[group];
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const known = nested.filter((s) => s.path[0] === group).map((s) => s.path[1]);
    for (const key of Object.keys(value)) if (!known.includes(key)) out.push(`${group}.${key}`);
  }
  return out;
}

/** Validates the text of settings.json as typed in the JSON mode: syntax, migrations, schema, unknown keys. */
export function checkSettingsText(text: string): SettingsTextCheck {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const line = jsonErrorLine(text, message);
    return { ok: false, errors: [`JSON invalide : ${message}`], ...(line !== undefined ? { line } : {}) };
  }
  let migrated: unknown;
  try {
    migrated = applyMigrations(json, {}, 1);
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)], line: lineOfPath(text, ["schemaVersion"]) ?? 1 };
  }
  const result = settingsSchema.safeParse(migrated);
  if (!result.success) {
    const issues = result.error.issues as unknown as IssueLike[];
    const line = issues.length > 0 ? lineOfPath(text, issues[0]!.path) : undefined;
    return { ok: false, errors: issues.map(describeIssue), ...(line !== undefined ? { line } : {}) };
  }
  const warnings = unknownKeys(migrated).map((k) => `Clé inconnue « ${k} » : elle sera ignorée.`);
  return { ok: true, value: result.data, warnings };
}
