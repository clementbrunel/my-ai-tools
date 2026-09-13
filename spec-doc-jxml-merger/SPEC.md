# spec-doc-jxml-merger — Spécification

Outil qui régénère la spécification d'un projet JWAY en un **markdown unique, éditable et versionné**, en croisant deux sources qui peuvent diverger :

- la spécification fonctionnelle existante, en **Word (.docx)** ;
- le **code JXML** du projet (technologie propriétaire JWAY — fichiers XML statiques avec balises propriétaires, transformés en Java au runtime ; seule la partie JXML statique est analysée ici).

## Vue d'ensemble

```
Frontend (Vite/React)                         Backend (Spring Boot)
┌────────────────────┐   POST /api/analysis (multipart)
│ .docx (Word)        │ ───┐
│ .zip OU texte collé  │ ───┼──────────►  WordSpecParser (Apache POI)
│ (JXML)               │    │              JxmlSpecParser (zip ou texte brut)
└────────────────────┘    │              DiffEngine → divergences
                            │              AIResolutionService (mistral-vibe) → proposition par divergence
                            │              MarkdownGenerator → markdown de fusion
                            ◄────────────┘
                      AnalysisSessionResponse { markdown, divergences }
                            │
        ┌───────────────────┼───────────────────┐
   Pane Word (lecture)  Pane Markdown (éditable)   Pane JXML (upload zip ou texte collé)
                            │
                 Enregistrer → nouvelle DocumentVersion (Postgres)
                 Historique → liste des versions, bouton "Restaurer"
                 Télécharger → export .md côté client (Blob)
```

## Stack

| Composant | Choix |
|---|---|
| Backend | Java 21 + Spring Boot 3.5 (aligné sur `prono-core`) |
| Frontend | Vite + React + TypeScript |
| Base de données | PostgreSQL 16 — persistance des sessions d'analyse et de l'historique des versions du markdown (pour pouvoir revenir en arrière sur les éditions) |
| IA | Client REST vers **mistral-vibe** (API interne, clé/token), derrière l'interface `SpecResolutionAIProvider` |
| Docker | `docker-compose.yml` (postgres + backend + frontend), sur le modèle de `prono-core` |

## Ingestion des sources

- **Word** : upload d'un fichier `.docx`.
- **JXML** : deux modes au choix dans le panneau droit —
  1. upload d'une **archive `.zip`** du dossier projet JWAY (fichiers `.jxml` potentiellement imbriqués/fragmentés) ;
  2. **coller directement le texte JXML** dans un champ de la page (pratique pour un extrait ponctuel, sans dossier complet).

## Modèle de données (Postgres)

- **`analysis_session`** — une analyse (titre, nom du fichier Word, type de source JXML, statut, dates).
- **`document_version`** — chaque état successif du markdown de fusion pour une session (`version_number`, `content`, `source` = `GENERATED` | `MANUAL_EDIT` | `RESTORED`). Une restauration crée une **nouvelle** version copiant le contenu ciblé (jamais de perte d'historique).
- **`divergence`** — chaque écart détecté entre Word et JXML pour une session (extraits des deux côtés, proposition de résolution IA, statut de résolution).

## API (MVP)

| Endpoint | Rôle |
|---|---|
| `POST /api/analysis` | Upload Word + JXML (zip ou texte) → parse, diff, résolution IA, génère la v1 du markdown |
| `GET /api/analysis/{id}` | Récupère la session + le markdown courant + les divergences |
| `GET /api/analysis/{id}/versions` | Historique des versions |
| `POST /api/analysis/{id}/versions` | Enregistre une édition manuelle du markdown → nouvelle version |
| `POST /api/analysis/{id}/versions/{versionId}/restore` | Restaure une version passée (nouvelle version copiant son contenu) |

L'export final (`.md`) se fait **côté client** (bouton "Télécharger", `Blob` du contenu édité) — pas de commit Git automatique ; l'utilisateur relit et versionne lui-même via son flow Git habituel.

## Résolution des divergences

Pour chaque divergence détectée par `DiffEngine`, `AIResolutionService` (mistral-vibe) propose une résolution + justification, injectée dans le markdown généré. L'utilisateur tranche en éditant directement le panneau central.

## Découpage des specs (granularité)

Pas figé. Hypothèse de travail : **découpage par écran**, avec un mécanisme de rattachement pour les fragments Word/JXML qui s'imbriquent sur plusieurs sources (un écran peut être assemblé depuis plusieurs fragments). À affiner avec des exemples réels de fichiers Word/JXML.

## Ce qui est volontairement en placeholder (MVP)

- `WordSpecParser` extrait le texte brut du `.docx` (pas encore de découpage par écran/section).
- `JxmlSpecParser` lit les fichiers `.jxml` comme du texte brut (pas encore de compréhension des balises propriétaires JWAY — en attente de la documentation JWAY à fournir).
- `DiffEngine` fait une comparaison naïve ligne à ligne (pas encore d'alignement sémantique par écran/champ).
- `MistralVibeClient` appelle un endpoint `/chat/completions` générique et **retombe sur un message explicite** si l'appel échoue — le contrat exact de l'API mistral-vibe (URL, payload) reste à confirmer.

Ces points sont des interfaces stables (`SpecResolutionAIProvider`, `WordSpecParser`, `JxmlSpecParser`, `DiffEngine`) dont l'implémentation s'affinera au fur et à mesure que la doc JWAY et le contrat mistral-vibe seront fournis — sans changer le reste du pipeline.
