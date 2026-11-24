import { t } from "@cbl-log/shared";
/**
 * Single source of truth for the keyboard shortcuts shown by the "Raccourcis clavier" window.
 * The handlers themselves live next to the code they drive (App.tsx, LogViewport.tsx, FilterBar.tsx,
 * the Electron menu): when one is added or changed there, update this list too.
 */
export interface Shortcut {
  /** One key combination, one entry per key cap: ["Ctrl", "Maj", "F"]. */
  keys: readonly string[];
  /** Alternative combination for the same action, shown after "ou". */
  alt?: readonly string[];
  label: string;
}

export interface ShortcutGroup {
  id: string;
  title: string;
  /** Short emoji-free glyph shown on the card header. */
  icon: string;
  shortcuts: readonly Shortcut[];
}

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    id: "files",
    title: t("Fichiers & onglets"),
    icon: "▤",
    shortcuts: [
      { keys: ["Ctrl", "O"], label: t("Ouvrir un ou plusieurs fichiers") },
      { keys: ["Ctrl", "W"], label: t("Fermer l'onglet actif") },
      { keys: ["Ctrl", "Maj", "D"], label: t("Afficher / masquer le panneau Docker") },
      { keys: ["Ctrl", ","], label: t("Configuration (settings.json)") },
    ],
  },
  {
    id: "search",
    title: t("Recherche"),
    icon: "⌕",
    shortcuts: [
      { keys: ["Ctrl", "F"], label: t("Rechercher dans le log") },
      { keys: ["F3"], label: t("Occurrence suivante") },
      { keys: ["Maj", "F3"], label: t("Occurrence précédente") },
      { keys: ["Échap"], label: t("Quitter le champ de recherche") },
    ],
  },
  {
    id: "filter",
    title: t("Filtre"),
    icon: "⏷",
    shortcuts: [
      { keys: ["Ctrl", "Maj", "F"], label: t("Aller au champ de filtre") },
      { keys: ["Entrée"], label: t("Ajouter le texte comme filtre « inclure »") },
      { keys: ["Ctrl", "Entrée"], label: t("Ajouter le texte comme filtre « exclure »") },
      { keys: ["Échap"], label: t("Quitter le champ de filtre") },
    ],
  },
  {
    id: "navigation",
    title: t("Navigation"),
    icon: "↕",
    shortcuts: [
      { keys: ["Ctrl", "G"], label: t("Aller à une ligne ou à une heure") },
      { keys: ["Ctrl", "Début"], label: t("Début du fichier") },
      { keys: ["Ctrl", "Fin"], label: t("Fin du fichier (et suivi en direct)"), alt: ["Fin"] },
      { keys: ["Double-clic"], label: t("Sur le numéro de ligne : voir la ligne dans son contexte") },
    ],
  },
  {
    id: "selection",
    title: t("Sélection & copie"),
    icon: "▭",
    shortcuts: [
      { keys: ["Double-clic"], label: t("Sélectionner un mot dans une ligne") },
      { keys: ["Clic droit"], label: t("Menu : copier, rechercher, inclure / exclure le texte") },
      { keys: ["Ctrl", "C"], label: t("Copier le texte sélectionné") },
      { keys: ["Ctrl", "A"], label: t("Tout sélectionner, puis Ctrl+C pour tout copier") },
      { keys: ["Ctrl", "Maj", "C"], label: t("Après Ctrl+A : tout copier avec les numéros de ligne") },
      { keys: ["Échap"], label: t("Annuler la sélection de toutes les lignes") },
    ],
  },
  {
    id: "view",
    title: t("Affichage"),
    icon: "Aa",
    shortcuts: [
      { keys: ["Pause"], label: t("Figer / reprendre la vue") },
      { keys: ["Ctrl", "L"], label: t("Effacer : masquer ce qui précède") },
      { keys: ["Ctrl", "H"], label: t("Règles de surlignage") },
      { keys: ["Ctrl", "+"], label: t("Zoom avant"), alt: ["Ctrl", "Molette ↑"] },
      { keys: ["Ctrl", "-"], label: t("Zoom arrière"), alt: ["Ctrl", "Molette ↓"] },
      { keys: ["Ctrl", "0"], label: t("Taille réelle (100 %)") },
    ],
  },
  {
    id: "help",
    title: t("Aide"),
    icon: "?",
    shortcuts: [{ keys: ["?"], label: t("Afficher cette fenêtre"), alt: ["F1"] }],
  },
];

const normalize = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Keeps the shortcuts whose label, key caps or group title contain every word of the query. */
export function filterGroups(groups: readonly ShortcutGroup[], query: string): ShortcutGroup[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...groups];
  return groups.flatMap((g) => {
    const shortcuts = g.shortcuts.filter((s) => {
      const hay = normalize([g.title, s.label, ...s.keys, ...(s.alt ?? [])].join(" "));
      return words.every((w) => hay.includes(w));
    });
    return shortcuts.length > 0 ? [{ ...g, shortcuts }] : [];
  });
}
