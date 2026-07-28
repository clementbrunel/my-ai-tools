export type ToolId = "rtk" | "headroom" | "caveman" | "mempalace" | "socraticode" | "ecc";

export interface InstallStep {
  label: string;
  command?: string; // runnable by --install
  manual?: string;  // instruction displayed but not auto-run
}

export interface CatalogueTool {
  id: ToolId;
  name: string;
  tagline: string;
  why: string;
  steps: InstallStep[];
  conflictGroup?: string;
}

export interface ConflictGroup {
  id: string;
  label: string;
  note: string;
  maxPick: number; // 1 = exclusive, 2 = pick at most 2, etc.
}

export const CONFLICT_GROUPS: ConflictGroup[] = [
  {
    id: "token",
    label: "Token reduction",
    note: "Ces outils réduisent ce qui entre dans la fenêtre de contexte. Ils se chevauchent — en choisir un seul suffit.",
    maxPick: 1,
  },
  {
    id: "memory",
    label: "Mémoire projet",
    note: "Les deux sont des serveurs MCP. MemPalace = notes que tu rédiges. SocratiCode = indexation auto du code (Docker requis). Compatibles sur un grand codebase inconnu, redondants sinon.",
    maxPick: 1,
  },
];

export const CATALOGUE: CatalogueTool[] = [
  {
    id: "rtk",
    name: "RTK (Rust Token Killer)",
    tagline: "Proxy CLI qui compresse les sorties shell avant qu'elles atteignent le modèle",
    why: "Meilleur choix si tu lances beaucoup de commandes shell dans tes sessions Claude. Léger, sans Python. S'intègre via un hook dans .claude/settings.json.",
    steps: [
      {
        label: "Installer le binaire",
        command: "cargo install rtk",
        manual: "ou télécharger le binaire depuis https://github.com/stscoundrel/rtk/releases",
      },
      {
        label: "Configurer le hook Claude Code",
        manual: 'Ajouter dans .claude/settings.json → hooks.PostToolUse : { "matcher": "Bash", "hooks": [{"type": "command", "command": "rtk"}] }',
      },
    ],
    conflictGroup: "token",
  },
  {
    id: "headroom",
    name: "Headroom",
    tagline: "Compression de contexte — réduit de 60-95 % les tokens des outputs, RAG chunks et JSON",
    why: "Idéal pour les workflows RAG-lourds ou quand les sorties d'outils sont très verbeux. Supporte plusieurs modes de déploiement : librairie Python/TS, proxy HTTP (zéro changement de code), ou serveur MCP.",
    steps: [
      {
        label: "Installer le package Python",
        command: "pip install headroom",
      },
      {
        label: "Mode proxy (optionnel, zero-code-change)",
        command: "pip install 'headroom[proxy]'",
      },
      {
        label: "Ajouter comme serveur MCP (optionnel)",
        manual: "claude mcp add headroom -- headroom mcp  (dans le terminal Claude Code)",
      },
    ],
    conflictGroup: "token",
  },
  {
    id: "caveman",
    name: "Caveman",
    tagline: "Skill Claude Code qui oriente le modèle vers des réponses concises",
    why: "Option la plus légère : zéro infrastructure, juste un plugin. Efficace pour réduire le bruit dans les réponses texte, mais ne compresse pas les sorties d'outils. À préférer si tu veux quelque chose d'immédiat et sans dépendances.",
    steps: [
      {
        label: "Installer le plugin dans Claude Code",
        manual: "/plugin install caveman@caveman  (à exécuter dans une session Claude Code)",
      },
    ],
    conflictGroup: "token",
  },
  {
    id: "mempalace",
    name: "MemPalace",
    tagline: "Serveur MCP de mémoire long-terme — notes et contexte que tu rédiges toi-même",
    why: "Permet à Claude Code de se souvenir de décisions, conventions et contexte projet entre les sessions. Tu contrôles ce qui est mémorisé. Pas de Docker, pas d'indexation automatique.",
    steps: [
      {
        label: "Installer le package Python",
        command: "pip install mempalace",
      },
      {
        label: "Ajouter comme serveur MCP",
        manual: "claude mcp add mempalace -- python -m mempalace  (dans le terminal Claude Code)",
      },
    ],
    conflictGroup: "memory",
  },
  {
    id: "socraticode",
    name: "SocratiCode",
    tagline: "Serveur MCP d'indexation de codebase — recherche sémantique, graphes de dépendances, analyse d'impact",
    why: "Donne à Claude une compréhension profonde de ton codebase : recherche hybride (vecteurs + BM25), traçage d'appels, blast-radius avant refactoring. Benchmarké à 61 % moins de contexte, 84 % moins d'appels d'outils sur de gros codebases. Nécessite Docker.",
    steps: [
      {
        label: "Vérifier que Docker est disponible",
        command: "docker info",
      },
      {
        label: "Installer le plugin dans Claude Code",
        manual: "/plugin install socraticode@socraticode  (dans une session Claude Code)",
      },
      {
        label: "Alternative — ajouter le serveur MCP manuellement",
        manual: "claude mcp add socraticode -- socraticode serve  (dans le terminal Claude Code)",
      },
    ],
    conflictGroup: "memory",
  },
  {
    id: "ecc",
    name: "ECC (Agent Harness OS)",
    tagline: "Framework tout-en-un : 67 agents, 271 skills, hooks et règles pour Claude Code, Cursor, Codex",
    why: "Installe d'un coup un ensemble complet de patterns de travail éprouvés (10+ mois de production). Inclut déjà une réduction de tokens similaire à Caveman. Choisir ECC OU les outils individuels — pas les deux, risque de conflits de hooks et de skills.",
    steps: [
      {
        label: "Installer le plugin dans Claude Code",
        manual: "/plugin install ecc@ecc  (dans une session Claude Code)",
      },
      {
        label: "Alternative — installation manuelle (plus de contrôle)",
        manual: "Voir https://github.com/affaan-m/ECC pour le script bash d'installation sélective",
      },
      {
        label: "Configurer le profil de hooks (optionnel)",
        manual: "export ECC_HOOK_PROFILE=strict  (dans ton shell profile)",
      },
    ],
  },
];

// Maps Integration.name (from scanner) to a catalogue ToolId.
export const INTEGRATION_TO_TOOL: Record<string, ToolId> = {
  "MemPalace": "mempalace",
  "Caveman": "caveman",
  "RTK (Rust Token Killer)": "rtk",
  "Headroom": "headroom",
  "ECC": "ecc",
  "SocratiCode": "socraticode",
};

// Default pick per conflict group when nothing is detected (easiest / least infra first).
const GROUP_DEFAULTS: Record<string, ToolId> = {
  token: "caveman",
  memory: "mempalace",
};

export function suggestMissing(detectedNames: string[]): ToolId[] {
  const detectedIds = new Set(
    detectedNames
      .map((n) => INTEGRATION_TO_TOOL[n])
      .filter((id): id is ToolId => id !== undefined)
  );

  const suggested: ToolId[] = [];

  for (const group of CONFLICT_GROUPS) {
    const groupTools = CATALOGUE.filter((t) => t.conflictGroup === group.id);
    const alreadyHasOne = groupTools.some((t) => detectedIds.has(t.id));
    if (!alreadyHasOne) {
      const defaultPick = GROUP_DEFAULTS[group.id];
      if (defaultPick) suggested.push(defaultPick);
    }
  }

  return suggested;
}

export function getToolById(id: string): CatalogueTool | undefined {
  return CATALOGUE.find((t) => t.id === id);
}

export function getConflicts(ids: ToolId[]): { group: ConflictGroup; picks: ToolId[] }[] {
  const result: { group: ConflictGroup; picks: ToolId[] }[] = [];
  for (const group of CONFLICT_GROUPS) {
    const picks = ids.filter((id) => {
      const tool = getToolById(id);
      return tool?.conflictGroup === group.id;
    });
    if (picks.length > group.maxPick) {
      result.push({ group, picks });
    }
  }
  // ECC + caveman conflict (ecc bundles it)
  if (ids.includes("ecc") && ids.includes("caveman")) {
    result.push({
      group: { id: "ecc-caveman", label: "ECC + Caveman", note: "ECC inclut déjà un mécanisme de réduction de verbosité similaire à Caveman.", maxPick: 1 },
      picks: ["ecc", "caveman"],
    });
  }
  return result;
}
