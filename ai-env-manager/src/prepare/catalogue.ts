export type ToolId = "rtk" | "headroom" | "caveman" | "mempalace" | "socraticode" | "ecc" | "karpathy-skills" | "graphify" | "ponytail" | "codeburn" | "openwiki" | "codealmanac";

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
    note: "MemPalace = notes que tu rédiges. SocratiCode = indexation auto du code par embeddings (Docker requis). Graphify = indexation auto du code par graphe déterministe AST (pas de Docker, inclut docs/PDF). OpenWiki = documentation Markdown générée par agent, versionnée dans le repo. CodeAlmanac = wiki Markdown versionné aussi, mais alimenté en continu par ce que tes sessions d'agent apprennent (macOS uniquement). Compatibles sur un grand codebase inconnu, redondants sinon.",
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
  {
    id: "karpathy-skills",
    name: "Andrej Karpathy Skills",
    tagline: "Guide-lines Claude Code inspirées d'Andrej Karpathy — évite les suppositions non vérifiées, la sur-ingénierie et les changements hors périmètre",
    why: "Utile pour réduire les erreurs classiques des agents de code : suppositions non vérifiées, sur-complexification, modifications hors-sujet, absence de critères de succès clairs. Zéro infrastructure — soit un plugin Claude Code, soit un simple fichier CLAUDE.md à copier dans le projet. Complémentaire à ECC/Caveman (pas de recouvrement : ceux-ci gèrent tokens/agents, pas la discipline de modification du code).",
    steps: [
      {
        label: "Ajouter le marketplace",
        manual: "/plugin marketplace add forrestchang/andrej-karpathy-skills  (dans une session Claude Code)",
      },
      {
        label: "Installer le plugin",
        manual: "/plugin install andrej-karpathy-skills@karpathy-skills  (dans une session Claude Code)",
      },
      {
        label: "Alternative — fichier CLAUDE.md",
        command: "curl -o CLAUDE.md https://raw.githubusercontent.com/forrestchang/andrej-karpathy-skills/main/CLAUDE.md",
        manual: "Ou ajouter le contenu à la fin d'un CLAUDE.md existant",
      },
    ],
  },
  {
    id: "graphify",
    name: "Graphify",
    tagline: "Transforme le codebase en graphe de connaissances interrogeable (AST tree-sitter + docs/PDF)",
    why: "Utile pour comprendre un gros codebase inconnu sans grep : mapping déterministe (pas d'embeddings vectoriels), relations traçables entre fichiers, requêtable en langage naturel via un skill Claude Code. Chevauche SocratiCode sur l'indexation de codebase — choisir l'un ou l'autre.",
    steps: [
      {
        label: "Installer le package",
        command: "uv tool install graphifyy",
        manual: "ou pipx install graphifyy",
      },
      {
        label: "Enregistrer le skill et les hooks Claude Code",
        command: "graphify install",
      },
      {
        label: "Serveur MCP (optionnel, après un premier build)",
        manual: "python -m graphify.serve graphify-out/graph.json",
      },
    ],
    conflictGroup: "memory",
  },
  {
    id: "ponytail",
    name: "Ponytail",
    tagline: "Skill Claude Code anti-sur-ingénierie — pousse l'agent vers l'implémentation minimale nécessaire",
    why: "Fait évaluer à l'agent une échelle de décision avant d'écrire du code (YAGNI, déjà dans le codebase ?, stdlib ?, one-liner ?...) plutôt que d'installer des dépendances ou d'écrire du boilerplate. Mesuré à ~54 % de code en moins, ~20 % moins cher, ~27 % plus rapide sur des sessions Claude Code réelles. Chevauche Karpathy Skills sur le même problème (sur-ingénierie, discipline de modification) — éviter de cumuler les deux.",
    steps: [
      {
        label: "Ajouter le marketplace",
        manual: "/plugin marketplace add DietrichGebert/ponytail  (dans une session Claude Code)",
      },
      {
        label: "Installer le plugin",
        manual: "/plugin install ponytail@ponytail  (dans une session Claude Code)",
      },
      {
        label: "Configurer le mode par défaut (optionnel)",
        manual: "export PONYTAIL_DEFAULT_MODE=full  (lite/full/ultra/off, dans ton shell profile)",
      },
      {
        label: "Alternative — fichiers de règles",
        manual: "Copier les fichiers depuis .cursor/rules/, .windsurf/rules/, .clinerules/, .github/copilot-instructions.md ou AGENTS.md selon ton éditeur/agent",
      },
    ],
  },
  {
    id: "codeburn",
    name: "CodeBurn",
    tagline: "Suivi des coûts et de la consommation de tokens sur 36 outils de code IA (Claude Code, Cursor, Codex, Gemini...)",
    why: "Utile pour voir où part réellement l'argent : répartition par modèle, projet et type de tâche, distinction entre overhead de conversation et travail de code productif, détection des patterns gaspilleurs. Complémentaire aux outils de réduction de tokens — CodeBurn mesure, il ne compresse pas.",
    steps: [
      {
        label: "Installer le package npm",
        command: "npm install -g codeburn",
        manual: "ou via Homebrew : brew install codeburn",
      },
      {
        label: "Ajouter comme serveur MCP (optionnel)",
        manual: "claude mcp add codeburn -- npx -y codeburn mcp  (dans le terminal Claude Code)",
      },
    ],
  },
  {
    id: "openwiki",
    name: "OpenWiki",
    tagline: "CLI (LangChain) qui écrit et maintient un wiki Markdown du codebase, lu comme mémoire par les agents",
    why: "Produit une documentation lisible par un humain ET par l'agent, versionnée dans le repo (répertoire openwiki/) plutôt que dans un index binaire. Se met à jour tout seul via un workflow CI qui ouvre une PR de doc à chaque changement. Consomme des appels LLM à chaque génération — nécessite une clé de provider. Chevauche SocratiCode et Graphify sur la compréhension du codebase, mais par la doc plutôt que par l'index.",
    steps: [
      {
        label: "Installer le CLI",
        command: "npm install -g openwiki",
        manual: "Embarque better-sqlite3, un module natif : si npm bloque son script d'install (allowScripts), le binaire n'est jamais produit et openwiki échoue au lancement sur 'Could not locate the bindings file' — réinstaller avec 'npm install -g openwiki --allow-scripts=better-sqlite3 --foreground-scripts'",
      },
      {
        label: "Derrière un proxy d'entreprise qui inspecte le TLS",
        manual: "setx NODE_USE_SYSTEM_CA 1  (Node 24.6+ ; sinon NODE_EXTRA_CA_CERTS vers un PEM du CA interne) — sans ça Node rejette le certificat ('self-signed certificate in certificate chain') : le binaire prébuilt de better-sqlite3 ne se télécharge pas à l'install, et les appels au provider échouent sur 'Connection error' au lancement",
      },
      {
        label: "Configurer une clé de provider",
        manual: "export ANTHROPIC_API_KEY=…  (ou OPENAI_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY) — openwiki la persiste dans ~/.openwiki/.env. Il faut une vraie clé API (console.anthropic.com) : l'auth OAuth d'un abonnement Claude Code ne convient pas",
      },
      {
        label: "Générer le wiki du projet",
        manual: "openwiki --init  (long, consomme des tokens ; puis 'openwiki --update' pour rafraîchir)",
      },
      {
        label: "Mise à jour automatique en CI (optionnel)",
        manual: "Copier openwiki-update.yml dans .github/workflows/ — ouvre une PR de doc quand le code change",
      },
    ],
    conflictGroup: "memory",
  },
  {
    id: "codealmanac",
    name: "CodeAlmanac",
    tagline: "Wiki de codebase maintenu par les agents — décisions, flux, invariants, pièges, en Markdown dans le repo",
    why: "Capture ce que le code ne dit pas (pourquoi telle décision, ce qui a déjà cassé, quels invariants comptent) plutôt que de ré-indexer le code lui-même. Se nourrit automatiquement de tes sessions Claude Code / Codex : un job local relit les conversations toutes les 5 h et en extrait ce qui mérite d'être écrit. Tout reste local et versionné dans le repo (répertoire almanac/), relu en PR comme du code. Réutilise l'authentification de ton agent existant — pas de clé API séparée. Limites : macOS uniquement pour l'instant, et Python 3.12+ requis. Chevauche OpenWiki (même approche wiki Markdown) et SocratiCode/Graphify (compréhension du codebase) — en choisir un seul.",
    steps: [
      {
        label: "Installer le CLI",
        command: "uv tool install codealmanac@latest",
        manual: "Nécessite Python 3.12+ et uv (https://docs.astral.sh/uv/) ; macOS uniquement pour l'instant",
      },
      {
        label: "Configurer le runner et les jobs d'automatisation",
        manual: "codealmanac setup --yes --runner claude  (sans --runner, Codex est choisi par défaut ; installe 3 jobs launchd : sync 5 h, garden 24 h, update 24 h)",
      },
      {
        label: "Créer le wiki dans le projet",
        command: "codealmanac init",
        manual: "Scaffolde almanac/ (topics.yaml, architecture/, decisions/, guides/) — à committer",
      },
      {
        label: "Désactiver la télémétrie (optionnel)",
        manual: "export DO_NOT_TRACK=1  (dans ton shell profile) — ou 'codealmanac config set telemetry.enabled false'",
      },
    ],
    conflictGroup: "memory",
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
  "Andrej Karpathy Skills": "karpathy-skills",
  "Graphify": "graphify",
  "Ponytail": "ponytail",
  "CodeBurn": "codeburn",
  "OpenWiki": "openwiki",
  "CodeAlmanac": "codealmanac",
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
  // Ponytail + Karpathy Skills conflict (both target over-engineering/scope discipline)
  if (ids.includes("ponytail") && ids.includes("karpathy-skills")) {
    result.push({
      group: { id: "ponytail-karpathy", label: "Ponytail + Karpathy Skills", note: "Les deux ciblent la sur-ingénierie et la discipline de modification — risque de règles redondantes ou contradictoires.", maxPick: 1 },
      picks: ["ponytail", "karpathy-skills"],
    });
  }
  return result;
}
