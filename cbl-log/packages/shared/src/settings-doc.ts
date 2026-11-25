// Documentation of settings.json for the "Configuration" window: one entry per setting (label, explanation,
// control, when it applies), plus the helpers shared by its two modes (form and raw JSON).
// The schema (config.ts) stays the reference for validation; this file only describes it to the user.
import { applyMigrations, defaultSettings, MAX_FONT_SIZE, MAX_SEARCH_HISTORY, MIN_FONT_SIZE, settingsSchema, type Settings } from "./config.js";
import { t } from "./i18n/index.js";

/** When a change is taken into account. */
export type SettingApply = "live" | "next-open" | "restart";

export type SettingControl =
  | { kind: "boolean" }
  | { kind: "enum"; options: readonly { value: string; label: string }[] }
  /** `choices`: offered as a drop-down list instead of a free field (a value set in the JSON is kept in the list). */
  /** `decimal`: decimals allowed (default: whole numbers only). */
  | { kind: "number"; min: number; max: number; step?: number; unit?: string; choices?: readonly number[]; decimal?: boolean }
  /**
   * Optional text: an empty field removes the key (the default behaviour then applies).
   * `emptyLabel` is how the absent value is shown ("(automatique)" by default).
   */
  | { kind: "text"; placeholder?: string; emptyLabel?: string }
  /** Several values among `options` (at least one), shown as check boxes. */
  | {
      kind: "flags";
      /** `values`: the stored values the option stands for (default: [value]), e.g. ERROR = fatal + error. */
      options: readonly { value: string; label: string; values?: readonly string[] }[];
      /** "level-pills": drawn like the level pills of the status bar (`value` = level whose colour is used). */
      appearance?: "level-pills";
    }
  /** Monospaced font installed on this computer, picked in a list; absent = the default (`emptyLabel`). */
  | { kind: "font"; emptyLabel: string }
  /** Map edited as a list (entries can only be removed). */
  | { kind: "map" };

export interface SettingDoc {
  /** Path of the key in settings.json: ["docker", "initialTail"]. */
  path: readonly string[];
  label: string;
  description: string;
  control: SettingControl;
  apply: SettingApply;
  /** Longer explanation, shown on demand (ⓘ) to keep the form short. */
  details?: string;
  /** Rarely changed: grouped under a folded « Avancé » block of its section. */
  advanced?: boolean;
}

export interface SettingSection {
  id: string;
  title: string;
  settings: readonly SettingDoc[];
}

export const SETTING_SECTIONS: readonly SettingSection[] = [
  {
    id: "general",
    title: t("Général"),
    settings: [
      {
        path: ["language"],
        label: t("Langue"),
        description: t("« Système » suit la langue de Windows."),
        control: {
          kind: "enum",
          options: [
            { value: "system", label: t("Système") },
            { value: "fr", label: "Français" },
            { value: "en", label: "English" },
          ],
        },
        apply: "restart",
      },
      {
        path: ["theme"],
        label: t("Thème"),
        description: t("Couleurs de l'interface ; « Système » suit Windows."),
        details: t("Le bouton soleil / lune de la barre d'état bascule aussi entre clair et sombre."),
        control: {
          kind: "enum",
          options: [
            { value: "system", label: t("Système") },
            { value: "light", label: t("Clair") },
            { value: "dark", label: t("Sombre") },
          ],
        },
        apply: "live",
      },
      {
        path: ["restoreSession"],
        label: t("Rouvrir les onglets au démarrage"),
        description: t("Avec leur position, leur filtre et leur nom."),
        control: { kind: "boolean" },
        apply: "restart",
      },
      {
        path: ["confirmCloseTabs"],
        label: t("Confirmer avant de fermer plusieurs onglets"),
        description: t("Clic droit sur un onglet › Fermer les autres / à droite / tous."),
        control: { kind: "boolean" },
        apply: "live",
      },
    ],
  },
  {
    id: "display",
    title: t("Affichage"),
    settings: [
      {
        path: ["viewer", "fontFamily"],
        label: t("Police"),
        description: t("Polices à chasse fixe installées sur ce poste."),
        control: { kind: "font", emptyLabel: "Consolas" },
        apply: "live",
      },
      {
        path: ["viewer", "fontSize"],
        label: t("Taille du texte"),
        description: t("Taille des lignes de log ; Ctrl+molette zoome toute la fenêtre."),
        control: { kind: "number", min: MIN_FONT_SIZE, max: MAX_FONT_SIZE, unit: "px", choices: [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24] },
        apply: "live",
      },
      {
        path: ["viewer", "showLineNumbers"],
        label: t("Numéros de ligne"),
        description: t("Dans la marge de gauche."),
        control: { kind: "boolean" },
        apply: "live",
      },
    ],
  },
  {
    id: "opening",
    title: t("Ouverture des fichiers"),
    settings: [
      {
        path: ["tabs", "followOnOpen"],
        label: t("Suivre la fin du fichier"),
        description: t("Sinon le fichier s'ouvre au début, sans suivi."),
        details: t("Les onglets rouverts au démarrage gardent leur état."),
        control: { kind: "boolean" },
        apply: "next-open",
      },
      {
        path: ["tabs", "foldTraces"],
        label: t("Replier les stack traces"),
        description: t("Une ligne par enregistrement, quand le format est reconnu."),
        control: { kind: "boolean" },
        apply: "next-open",
      },
      {
        path: ["tabs", "levels"],
        label: t("Niveaux affichés par défaut"),
        description: t("Les pastilles de niveau réaffichent les autres."),
        details: t("ERROR comprend FATAL, comme la pastille de la barre d'état."),
        control: {
          kind: "flags",
          appearance: "level-pills",
          options: [
            { value: "error", label: "ERROR", values: ["fatal", "error"] },
            { value: "warn", label: "WARN" },
            { value: "info", label: "INFO" },
            { value: "debug", label: "DEBUG" },
            { value: "trace", label: "TRACE" },
          ],
        },
        apply: "next-open",
      },
      {
        path: ["historyHours"],
        label: t("Archives récentes chargées"),
        description: t("Archives de rotation modifiées depuis moins de N heures ; 0 = le fichier seul."),
        details: t("app.log.1, app-2026-11-03.log… sont chargées avant le fichier suivi."),
        control: { kind: "number", min: 0, max: 720, step: 1, unit: t("heures"), decimal: true },
        apply: "next-open",
      },
      {
        path: ["archivePatterns"],
        label: t("Motifs d'archives appris"),
        description: t("Appris par clic droit sur le chemin › « Désigner une archive du rolling… »."),
        details: t("Supprimer une entrée revient à la détection automatique."),
        control: { kind: "map" },
        apply: "next-open",
      },
    ],
  },
  {
    id: "search",
    title: t("Recherche et alertes"),
    settings: [
      {
        path: ["searchHistorySize"],
        label: t("Historique des recherches"),
        description: t("Flèche bas dans le champ de recherche ; 0 = pas d'historique."),
        control: { kind: "number", min: 0, max: MAX_SEARCH_HISTORY, step: 5, unit: t("recherches") },
        apply: "live",
      },
      {
        path: ["ruleNotifications"],
        label: t("Notifications des règles 🔔"),
        description: t("Notification Windows pour les règles cochées 🔔 dans l'éditeur de règles."),
        details: t("Rien si l'onglet est déjà affiché ; les lignes d'une même règle sont regroupées 30 s ; un clic montre la ligne."),
        control: { kind: "boolean" },
        apply: "live",
      },
    ],
  },
  {
    id: "docker",
    title: "Docker",
    settings: [
      {
        path: ["docker", "enabled"],
        label: t("Activer Docker"),
        description: t("Panneau des conteneurs de Docker Desktop (Ctrl+Maj+D)."),
        control: { kind: "boolean" },
        apply: "live",
      },
      {
        path: ["docker", "initialTail"],
        label: t("Lignes chargées à l'ouverture"),
        description: t("« Charger plus d'historique » remonte ensuite ×10."),
        control: { kind: "number", min: 1, max: 1_000_000, step: 1000, unit: t("lignes") },
        apply: "next-open",
      },
      {
        path: ["docker", "host"],
        label: t("Adresse de Docker"),
        description: t("npipe://… ou tcp://… ; vide = détection automatique."),
        details: t("Vide : variable DOCKER_HOST, puis le contexte Docker courant, puis le pipe de Docker Desktop."),
        control: { kind: "text", placeholder: "tcp://127.0.0.1:2375" },
        apply: "restart",
        advanced: true,
      },
      {
        path: ["docker", "spoolMaxMb"],
        label: t("Taille max de la copie locale"),
        description: t("Les logs d'un conteneur sont copiés dans un fichier, renouvelé au-delà."),
        control: { kind: "number", min: 1, max: 100_000, step: 64, unit: t("Mo") },
        apply: "restart",
        advanced: true,
      },
      {
        path: ["docker", "keepSpoolOnClose"],
        label: t("Conserver la copie locale à la fermeture"),
        description: t("Garde l'historique d'un conteneur supprimé."),
        control: { kind: "boolean" },
        apply: "restart",
        advanced: true,
      },
    ],
  },
  {
    id: "system",
    title: t("Windows et mises à jour"),
    settings: [
      {
        path: ["checkForUpdates"],
        label: t("Mises à jour automatiques"),
        description: t("Vérifie au démarrage puis toutes les heures sur GitHub."),
        details: t("Seul accès réseau de l'application : une requête GET vers api.github.com, rien n'est envoyé. « Aide › Rechercher une mise à jour… » reste disponible."),
        control: { kind: "boolean" },
        apply: "live",
      },
      {
        path: ["updateChannel"],
        label: t("Canal de mise à jour"),
        description: t("« Bêta » propose aussi les versions de test."),
        details: t("Revenir à « Stable » propose la prochaine version stable, jamais une plus ancienne."),
        control: {
          kind: "enum",
          options: [
            { value: "stable", label: t("Stable") },
            { value: "beta", label: t("Bêta") },
          ],
        },
        apply: "live",
      },
      {
        path: ["explorerContextMenu"],
        label: t("Menu « Ouvrir avec cbl-log »"),
        description: t("Au clic droit sur un fichier dans l'Explorateur."),
        details: t("Sous Windows 11 : « Afficher d'autres options ». Le fichier s'ouvre dans la fenêtre déjà ouverte. Retiré à la désinstallation."),
        control: { kind: "boolean" },
        apply: "live",
      },
    ],
  },
];

export const APPLY_LABELS: Readonly<Record<SettingApply, string>> = {
  live: t("Immédiat"),
  "next-open": t("À la prochaine ouverture"),
  restart: t("Au prochain lancement"),
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
  const where = issue.path.length > 0 ? issue.path.map(String).join(".") : t("(racine)");
  let what: string;
  switch (issue.code) {
    case "invalid_type":
      what = t("type attendu : {value}", { value: String(issue.expected) });
      break;
    case "too_big":
      what = t("valeur maximale : {value}", { value: String(issue.maximum) });
      break;
    case "too_small":
      what = t("valeur minimale : {value}", { value: String(issue.minimum) });
      break;
    case "invalid_value":
      what = issue.values ? t("valeurs possibles : {values}", { values: issue.values.map((v) => JSON.stringify(v)).join(", ") }) : issue.message;
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
    return { ok: false, errors: [t("JSON invalide : {message}", { message })], ...(line !== undefined ? { line } : {}) };
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
  const warnings = unknownKeys(migrated).map((k) => t("Clé inconnue « {key} » : elle sera ignorée.", { key: k }));
  return { ok: true, value: result.data, warnings };
}
