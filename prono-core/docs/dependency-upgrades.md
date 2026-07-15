# Dépendances à mettre à jour

Snapshot pris le 2026-07-15 (`npm outdated` côté frontend, `mvn versions:display-dependency-updates`
côté backend). À traiter dans une tâche dédiée, séparée des changements fonctionnels — certaines de ces
montées de version sont majeures et cassantes.

## Frontend (`frontend/package.json`)

| Package | Actuelle | Dispo | Type | Notes |
|---|---|---|---|---|
| `@playwright/test` | 1.61.0 | 1.61.1 | patch | sans risque |
| `@vitest/coverage-v8` | 4.1.9 | 4.1.10 | patch | sans risque |
| `autoprefixer` | 10.5.0 | 10.5.3 | patch | sans risque |
| `postcss` | 8.5.15 | 8.5.19 | patch | sans risque |
| `vitest` | 4.1.9 | 4.1.10 | patch | sans risque |
| `axios` | 1.17.0 | 1.18.1 | minor | vérifier le changelog avant de monter |
| `@testing-library/react` | 14.3.1 | 16.3.2 | major | liée à la montée React 19 |
| `@types/react` | 18.3.31 | 19.2.17 | major | liée à la montée React 19 |
| `@types/react-dom` | 18.3.7 | 19.2.3 | major | liée à la montée React 19 |
| `react` | 18.3.1 | 19.2.7 | major | changements de comportement (refs, StrictMode, etc.) |
| `react-dom` | 18.3.1 | 19.2.7 | major | à monter en même temps que `react` |
| `react-router-dom` | 6.30.4 | 7.18.1 | major | breaking changes sur les data routers |
| `@vitejs/plugin-react` | 4.7.0 | 6.0.3 | major | vérifier compat avec la version de Vite retenue |
| `jsdom` | 24.1.3 | 29.1.1 | major | env de test Vitest, à valider après montée |
| `tailwindcss` | 3.4.19 | 4.3.2 | major | Tailwind 4 change la config (plus de `tailwind.config.js` par défaut) |
| `typescript` | 5.9.3 | 7.0.2 | major (x2) | passe par la 6.x, revoir la config `tsconfig` |
| `vite` | 6.4.3 | 8.1.4 | major (x2) | passe par la 7.x, vérifier les plugins (`@vitejs/plugin-react`) |

## Backend (`backend/pom.xml`)

Dépendances déclarées explicitement (les nombreuses dépendances gérées par le BOM Spring Boot mais non
utilisées directement dans le projet ne sont pas listées ici) :

| Package | Actuelle | Dispo | Type | Notes |
|---|---|---|---|---|
| `org.postgresql:postgresql` | 42.7.5 | 42.7.13 | patch | sans risque |
| `org.projectlombok:lombok` | 1.18.30 | 1.18.46 | patch | sans risque |
| `io.jsonwebtoken:jjwt-*` | 0.12.3 | 0.13.0 | minor | vérifier le changelog jjwt |
| `org.commonmark:commonmark` | 0.22.0 | 0.29.0 | minor | vérifier le changelog |
| `com.h2database:h2` | 2.2.224 | 2.4.240 | minor | scope test uniquement |
| `org.mapstruct:mapstruct` / `mapstruct-processor` | 1.5.5.Final | 1.7.0.Beta2 | minor (beta) | attendre une version stable 1.6.x/1.7.x avant de monter |
| `org.flywaydb:flyway-core` / `flyway-database-postgresql` | 10.10.0 | 12.11.0 | major (x2) | revoir les migrations existantes avant de monter |
| `org.springdoc:springdoc-openapi-starter-webmvc-ui` | 2.3.0 | 3.0.3 | major | nécessite Spring Boot 4 (springdoc 3 cible Boot 4) |
| **Spring Boot** (`spring-boot-starter-parent` + tous les starters) | 3.3.11 | 4.1.0 | major | gros chantier — cascade sur `spring-security` (6.3.9 → 7.1.0), `spring-boot-maven-plugin`, et potentiellement d'autres starters ; à faire dans sa propre tâche, isolée de tout le reste |

## Suggestion de découpage

1. Patches sans risque (frontend + backend) — un seul PR, quasi mécanique.
2. Minor à changelog à vérifier (`axios`, `jjwt-*`, `commonmark`, `h2`) — un PR, avec passage des tests.
3. Majors frontend liés à React 19 (`react`, `react-dom`, `@types/react*`, `@testing-library/react`,
   `react-router-dom`, `@vitejs/plugin-react`, `jsdom`) — un chantier dédié, tests + vérif manuelle de l'UI.
4. Tailwind 4 et TypeScript/Vite (majors x2) — chantiers séparés, changements de config à anticiper.
5. Spring Boot 4 (+ Spring Security 7, Springdoc 3, Flyway 12) — le plus gros chantier, à isoler entièrement.
