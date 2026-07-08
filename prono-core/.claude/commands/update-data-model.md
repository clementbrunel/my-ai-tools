# update-data-model

Mettre à jour `docs/data-model.md` à partir des migrations Flyway, puis générer une image PNG du diagramme.

## Étapes

### 1. Lire toutes les migrations

Lire les fichiers SQL dans `backend/src/main/resources/db/migration/` par ordre de version (V1, V2, ..., Vn).

Ne pas lire les fichiers du dossier `target/`.

### 2. Reconstruire le schéma courant

En appliquant les migrations dans l'ordre, déduire l'état final du schéma :
- Tables existantes (CREATE TABLE, ALTER TABLE ADD COLUMN, DROP COLUMN, RENAME, etc.)
- Colonnes avec leur type SQL et contraintes (PK, FK, UK)
- Relations entre tables (FK)

Ignorer les migrations de seed data (INSERT INTO, UPDATE, DELETE).

### 3. Mettre à jour `docs/data-model.md`

Réécrire le fichier **en conservant la structure existante** :

1. **Diagramme mermaid** (`erDiagram`) — reconstruire entièrement à partir du schéma déduit
2. **Tables et descriptions** — mettre à jour les tableaux de colonnes pour refléter le schéma actuel. Conserver les descriptions textuelles existantes quand elles sont encore valides.
3. **Énumérations** — mettre à jour si de nouvelles valeurs ont été ajoutées
4. **Évolution du schéma (Flyway)** — ajouter les nouvelles migrations à la liste

### 4. Générer l'image PNG

Extraire le bloc mermaid du fichier mis à jour dans un fichier temporaire, puis exécuter :

```bash
mmdc -i docs/data-model.mmd -o docs/data-model.png -t dark -b transparent
```

Si `mmdc` n'est pas disponible en PATH, essayer :
```bash
npx @mermaid-js/mermaid-cli -i docs/data-model.mmd -o docs/data-model.png -t dark -b transparent
```

Supprimer le fichier `.mmd` temporaire après génération.

## Notes

- Le fichier de destination est `docs/data-model.md` (relatif à la racine `prono-core/`)
- L'image générée est `docs/data-model.png`
- Ne pas modifier les commentaires ou descriptions en français existants sans raison
- En cas de doute sur une migration ambiguë, préférer conserver l'état précédent et signaler l'ambiguïté
