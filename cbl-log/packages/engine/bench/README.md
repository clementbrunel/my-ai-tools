# bench — générateur de gros logs et mesures du moteur

Mesure le moteur (`packages/engine`) sur de gros fichiers : NF-01 (fin visible), NF-02 (mémoire),
NF-03 (indexation), NF-04 (follow à 10 000 lignes/s), NF-11 (8 logs suivis en parallèle).
**Hors `npm test` et hors CI** (trop long). Seul le générateur est couvert par un test rapide
(`test/bench-generator.test.ts`, ~1 Mo).

## Utilisation

Depuis `cbl-log/` (ou `cbl-log/packages/engine/`) :

```bash
npm run bench -- --size 1G                         # tout, sur un log de 1 Gio
npm run bench -- --size 10G --json run-10g.json    # objectif NF : 10 Gio, résultats en JSON
npm run bench -- --size 200M --only index,follow   # une partie seulement
npm run bench -- --size 10G --generate-only        # prépare juste le fichier
npm run bench -- --help
```

Le script compile (`tsc -p tsconfig.bench.json` vers `dist/bench-build/`) puis lance
`node --expose-gc` (le GC explicite rend les mesures mémoire reproductibles).

| Option | Rôle |
|---|---|
| `--size <n>` | taille du log : `200M`, `1G`, `10G` (unités binaires ; défaut `1G`) |
| `--format` | `websphere-basic` (défaut) ou `raw` |
| `--dir <path>` | dossier de sortie (défaut `os.tmpdir()/cbl-log-bench`) |
| `--force` | régénère le fichier même s'il existe déjà avec la bonne taille |
| `--only <liste>` | `tail`, `index`, `memory`, `lines`, `follow`, `multi` (séparés par des virgules) |
| `--duration <s>` | durée de chaque run follow / multi (défaut 10 s) |
| `--rates <liste>` | débits du follow en lignes/s (défaut `1000,10000`) |
| `--multi-files <n>` | nombre de tailers de la mesure `multi` (défaut 8) |
| `--multi-total <n>` | contenu préexistant total des fichiers `multi` (défaut `1G` ; `10G` pour le NF-11 complet) |
| `--seed <n>` | graine du générateur (défaut 1) |
| `--json <fichier>` | écrit aussi les résultats en JSON (métadonnées machine + mesures) |

Le code de sortie vaut 1 si une cible n'est pas atteinte.

## Générateur

- Écriture en flux (blocs de 4 Mio) : jamais le fichier entier en mémoire. 10 Gio en ~50 s ici.
- Déterministe pour (format, taille, graine) : le fichier `<format>-<octets>.log` est **réutilisé** s'il existe avec la bonne taille.
  Il est écrit sous `.partial` puis renommé, donc une génération interrompue n'est jamais prise pour un fichier complet.
- `websphere-basic` : `[10/14/26 10:02:11:204 CEST] 0000004a SystemOut     O message`, niveaux variés (O, R, I, A, W, E),
  stack traces multi-lignes (tous les `E`/`R` et ~1 ligne sur 400, avec parfois `Caused by:`). `raw` : texte brut sans horodatage.
- ASCII pur, lignes terminées par `\n`. Le dernier octet est toujours un `\n` (la dernière ligne peut être tronquée pour tomber pile sur la taille).

## Ce qui est mesuré

| # | Scénario | Mesure | Cible |
|---|---|---|---|
| 1 | `tail` | ouverture + détection d'encodage + `readTail(500)` jusqu'à la fin visible (pire de 5 runs) | NF-01 : ≤ 1 000 ms |
| 2 | `index` | indexation complète par `LineIndex.indexWithWorker()` | NF-03 : ≥ 300 Mio/s |
| 3 | `memory` | RSS / heap / mémoire externe avant et après indexation + lectures aléatoires ; taille du store de checkpoints | NF-02 : RSS ≤ 250 Mio (400 Mio – 150 Mio de socle Electron) |
| 4 | `lines` | latence de 2 000 `getLines(n, 60)` aléatoires (p50/p95/p99) | interne : p95 ≤ 50 ms |
| 5 | `follow` | un processus écrivain à 1 000 puis 10 000 lignes/s suivi par un `Tailer` : latence écriture → événement `rows`, lignes perdues, retard de la boucle d'événements | NF-04 : p95 ≤ 250 ms, 0 perdue, lag p99 ≤ 50 ms (interne) |
| 6 | `multi` | 8 `Tailer` simultanés à 1 000 lignes/s chacun sur des fichiers préexistants (copies d'un log généré, indexés par worker) | NF-11 : mêmes cibles + RSS ≤ 250 Mio |

Remarques de méthode :

- Les écrivains tournent dans un **processus séparé** (`writer.ts`) ; chaque ligne porte son numéro de séquence et l'heure
  d'écriture (`O #<seq>#<ms>#`). La latence est `heure de l'événement rows − heure d'écriture` (horloge murale, même machine).
  Les lignes perdues = écrites − relues via `getLines` (la ligne ouverte en fin de fichier est laissée au passage suivant, comme le fait l'UI).
- La **génération du log se fait dans un processus fils** pour ne pas gonfler le RSS de départ du processus mesuré.
- Le « p95 ≤ 250 ms » est un choix de lecture de la cible NF-04 « < 250 ms » ; le maximum est aussi affiché.
- Pas de scénario recherche/filtre (NF-05) : le moteur n'a pas encore de recherche (architecture § 4.5).
- Le débit d'indexation dépend du cache disque de l'OS : juste après génération, une partie du fichier est en cache (voir le tableau).
- « Indépendante de la taille du fichier » (NF-02) : comparer les runs `--size 1G` et `--size 10G` ; seul le store de checkpoints croît (≈ 1,6 à 2 Mio par Gio).

## Résultats mesurés

Machine : Intel Core i5-14600KF (20 threads), 31,8 Go de RAM, Windows 11, Node 26.8.1, SSD local (fichiers dans `%TEMP%`),
17 octobre 2026. `npm run bench -- --size <n> --duration 10`, format `websphere-basic`.

| Mesure | Cible | 1 Gio | 10 Gio |
|---|---|---|---|
| Fin visible (500 lignes), pire de 5 — NF-01 | ≤ 1 000 ms | 2,2 ms ✅ | 4,3 ms ✅ |
| Débit d'indexation worker — NF-03 | ≥ 300 Mio/s | 1 428 Mio/s ✅ | 1 281 Mio/s ✅ (8 s) |
| Lignes indexées | – | 12,6 M | 126 M |
| `getLines(·, 60)` aléatoire p50 / p95 / p99 | p95 ≤ 50 ms | 0,3 / 0,7 / 1,3 ms ✅ | 0,7 / 1,2 / 1,8 ms ✅ |
| RSS avant | – | 48 Mio | 48 Mio |
| RSS après indexation | – | 66 Mio | 110 Mio |
| RSS après indexation + lectures aléatoires — NF-02 | ≤ 250 Mio | 178 Mio ✅ | 208 Mio ✅ |
| Heap utilisé après | – | 5 Mio | 5 Mio |
| Store de checkpoints | – | 2 Mio | 16 Mio |
| Follow 1 000 l/s : latence p50 / p95 / max — NF-04 | p95 ≤ 250 ms | 127 / 238 / 253 ms ✅ | 140 / 252 / 267 ms ❌ |
| Follow 1 000 l/s : lignes perdues | 0 | 0 ✅ | 0 ✅ |
| Follow 10 000 l/s : latence p50 / p95 / max — NF-04 | p95 ≤ 250 ms | 128 / 239 / 255 ms ✅ | 142 / 253 / 268 ms ❌ |
| Follow 10 000 l/s : lignes perdues | 0 | 0 ✅ | 0 ✅ |
| Follow : lag boucle d'événements p99 | ≤ 50 ms | 6,5 ms ✅ | 6,5 ms ✅ |
| Multi 8 × 1 000 l/s : latence p50 / p95 / max — NF-11 | p95 ≤ 250 ms | 136 / 253 / 275 ms ❌ | 148 / 263 / 284 ms ❌ |
| Multi : lignes perdues | 0 | 0 ✅ | 0 ✅ |
| Multi : lag boucle p99 | ≤ 50 ms | 11 ms ✅ | 10,5 ms ✅ |
| Multi : RSS après écriture | ≤ 250 Mio | 79 Mio ✅ | 79 Mio ✅ |

(Les runs « multi » utilisent 8 fichiers préexistants totalisant 1 Gio, pas 10 Gio : `--multi-total 10G` pour le cas complet.)

**Lecture des résultats**

- NF-01, NF-02, NF-03, getLines et zéro perte : très largement atteints, et la mémoire ne dépend pas de la taille
  (seul le store de checkpoints croît, ~1,6–2 Mio/Gio ; le reste vient du cache de blocs de 64 Mio, plafonné).
- La latence write→`rows` est **bornée par la période de poll (250 ms) + la fenêtre de coalescence (50 ms)** :
  p50 ≈ 130 ms, max ≈ 255–285 ms, quel que soit le débit (1 000 ou 10 000 l/s). Le p95 oscille donc autour de la cible de 250 ms
  et passe ❌ ou ✅ selon la charge du moment (3 runs sur 3 ❌ en multi). Le `fs.watch` censé accélérer la détection ne semble
  pas la réduire sur Windows avec un écrivain qui garde son handle ouvert (hypothèse non vérifiée).
- Débit d'indexation : mesuré avec le fichier encore largement dans le cache disque de l'OS (juste généré) ; un run à froid sera plus lent.
