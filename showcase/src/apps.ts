export type Lang = 'fr' | 'en'
export type L10n = Record<Lang, string>

export interface AppEntry {
  id: string
  name: string
  stage: 'prono' | 'bbb' | 'cli'
  /** Generated poster (public/scenes/<id>.jpg) shown full-bleed behind the scene. Apps without one need an `art` in their scene component. */
  scene?: string
  /** width / height of `scene`. When set, scene overlays are anchored to the image (they stay on the same spot whatever the crop). */
  sceneRatio?: number
  /** Full-bleed scene theme. */
  theme: { bg: string; ink: string; punch: string; punchInk: string; font: string; dark: boolean }
  kind: L10n
  headline: Record<Lang, [string, string]> // [plain text (\n = extra smaller line), highlighted line]
  description: L10n
  tags: string[]
  links: { label: L10n; url: string }[]
  /** Work in progress: shows a labelled progress bar (value 0..1) instead of / next to the links. */
  progress?: { label: L10n; value: number }
}

// Single source of truth: add an entry here to add a scene.
export const apps: AppEntry[] = [
  {
    id: 'bienvenuebebe',
    name: 'BienvenueBébé',
    stage: 'bbb',
    scene: './scenes/bienvenuebebe.jpg',
    sceneRatio: 1488 / 716,
    theme: {
      bg: 'linear-gradient(160deg, #fde9ef 0%, #fbdde8 40%, #e9e4f8 100%)',
      ink: '#4a2b3a', punch: '#e193b3', punchInk: '#ffffff', dark: false,
      font: 'Fraunces,"Playfair Display",Georgia,serif',
    },
    kind: { fr: 'Web app · en ligne', en: 'Web app · live' },
    headline: { fr: ['Un bébé arrive.', 'La liste suit.'], en: ['A baby is coming.', 'The list follows.'] },
    description: {
      fr: 'Crée gratuitement ta liste de naissance et partage-la. Tes proches réservent les cadeaux en un clic, sans doublon, sans se marcher dessus.',
      en: 'Create your birth registry for free and share it. Family and friends reserve gifts in one click, no duplicates, no overlap.',
    },
    tags: ['React', 'TypeScript', 'FR · EN · DE'],
    links: [{ label: { fr: 'Créer ma liste', en: 'Create my list' }, url: 'https://bienvenuebebe.com' }],
  },
  {
    id: 'prono-core',
    name: 'Prono-core',
    stage: 'prono',
    scene: './scenes/prono-core.jpg',
    theme: {
      bg: 'radial-gradient(ellipse at 70% 30%, #1f7a4d 0%, #0d3b28 45%, #06170f 100%)',
      ink: '#ffffff', punch: '#FFD700', punchInk: '#0a1628', dark: true,
      font: '"Bebas Neue","Anton",Impact,"Arial Narrow",sans-serif',
    },
    kind: { fr: 'Web app · en ligne', en: 'Web app · live' },
    headline: { fr: ['Foot ou F1 entre potes :\nPas d’argent, pas de prise de tête…', 'Juste quelques gages !'], en: ['Football or F1 with friends:\nNo money, no hassle…', 'Just a few forfeits!'] },
    description: {
      fr: 'Crée ton groupe, devine les scores, grimpe au classement.',
      en: 'Create your group, guess the scores, climb the leaderboard.',
    },
    tags: ['React', 'Spring Boot', 'PostgreSQL'],
    links: [{ label: { fr: 'Jouer', en: 'Play' }, url: 'https://prono-core.top' }],
  },
  {
    id: 'ai-env-manager',
    name: 'ai-env-manager',
    stage: 'cli',
    theme: {
      bg: 'linear-gradient(180deg, #0b0f0c 0%, #101a13 100%)',
      ink: '#d6f5df', punch: '#7dff9b', punchInk: '#06210f', dark: true,
      font: '"JetBrains Mono","Space Mono",ui-monospace,Menlo,monospace',
    },
    kind: { fr: 'CLI · bientôt open source', en: 'CLI · open source soon' },
    headline: { fr: ['Ton setup IA,', 'sous contrôle.'], en: ['Your AI setup,', 'under control.'] },
    description: {
      fr: 'Scanne, diagnostique et gère un projet Claude Code : serveurs MCP, contexte, hooks, mises à jour, catalogue d’outils, migration vers Mistral.',
      en: 'Scans, diagnoses and manages a Claude Code project: MCP servers, context, hooks, updates, tool catalogue, migration to Mistral.',
    },
    tags: ['TypeScript', 'Node', 'CLI'],
    // code will be published in a dedicated public repo (issue #352): no link to the monorepo until then
    links: [],
    progress: { label: { fr: 'Publication du code en cours', en: 'Publishing the source code' }, value: 0.6 },
  },
]

/** Optional dark poster behind the home title (public/scenes/hero.jpg). Keep it dark: the title is light on top of it. */
export const heroScene: string | undefined = './scenes/hero.jpg'
/** width / height of `heroScene`. */
export const heroSceneRatio = 1360 / 768

// Public profile links (from github.com/clementbrunel/clementbrunel).
export const profile = {
  name: 'Clément Brunel',
  linkedin: 'https://www.linkedin.com/in/c-brunel/',
  github: 'https://github.com/clementbrunel',
}
