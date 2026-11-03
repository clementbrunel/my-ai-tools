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
    title: "Fichiers & onglets",
    icon: "▤",
    shortcuts: [
      { keys: ["Ctrl", "O"], label: "Ouvrir un ou plusieurs fichiers" },
      { keys: ["Ctrl", "W"], label: "Fermer l'onglet actif" },
      { keys: ["Ctrl", "Maj", "D"], label: "Afficher / masquer le panneau Docker" },
    ],
  },
  {
    id: "search",
    title: "Recherche",
    icon: "⌕",
    shortcuts: [
      { keys: ["Ctrl", "F"], label: "Rechercher dans le log" },
      { keys: ["F3"], label: "Occurrence suivante" },
      { keys: ["Maj", "F3"], label: "Occurrence précédente" },
      { keys: ["Échap"], label: "Quitter le champ de recherche" },
    ],
  },
  {
    id: "filter",
    title: "Filtre",
    icon: "⏷",
    shortcuts: [
      { keys: ["Ctrl", "Maj", "F"], label: "Aller au champ de filtre" },
      { keys: ["Entrée"], label: "Ajouter le texte comme filtre « inclure »" },
      { keys: ["Ctrl", "Entrée"], label: "Ajouter le texte comme filtre « exclure »" },
      { keys: ["Échap"], label: "Quitter le champ de filtre" },
    ],
  },
  {
    id: "navigation",
    title: "Navigation",
    icon: "↕",
    shortcuts: [
      { keys: ["Ctrl", "G"], label: "Aller à une ligne ou à une heure" },
      { keys: ["Ctrl", "Début"], label: "Début du fichier" },
      { keys: ["Ctrl", "Fin"], label: "Fin du fichier (et suivi en direct)", alt: ["Fin"] },
    ],
  },
  {
    id: "selection",
    title: "Sélection & copie",
    icon: "▭",
    shortcuts: [
      { keys: ["Ctrl", "A"], label: "Sélectionner toutes les lignes" },
      { keys: ["Ctrl", "C"], label: "Copier la sélection" },
      { keys: ["Ctrl", "Maj", "C"], label: "Copier avec les numéros de ligne" },
      { keys: ["Échap"], label: "Annuler la sélection" },
    ],
  },
  {
    id: "view",
    title: "Affichage",
    icon: "Aa",
    shortcuts: [
      { keys: ["Pause"], label: "Figer / reprendre la vue" },
      { keys: ["Ctrl", "L"], label: "Effacer : masquer ce qui précède" },
      { keys: ["Ctrl", "H"], label: "Règles de surlignage" },
      { keys: ["Ctrl", "+"], label: "Zoom avant", alt: ["Ctrl", "Molette ↑"] },
      { keys: ["Ctrl", "-"], label: "Zoom arrière", alt: ["Ctrl", "Molette ↓"] },
      { keys: ["Ctrl", "0"], label: "Taille réelle (100 %)" },
    ],
  },
  {
    id: "help",
    title: "Aide",
    icon: "?",
    shortcuts: [{ keys: ["?"], label: "Afficher cette fenêtre", alt: ["F1"] }],
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
