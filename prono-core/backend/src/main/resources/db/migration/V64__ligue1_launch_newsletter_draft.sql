-- Draft newsletter announcing the upcoming Ligue 1 betting mode, ready to
-- review and send from the admin ⚙️ → Newsletters tab. The Ligue 1 competition
-- itself is being built on a separate branch — this newsletter only teases the
-- arrival and points to the existing /foot section in the meantime. The CTA
-- URL below is relative ('/foot'); confirm it resolves correctly (or swap it
-- for an absolute FRONTEND_URL-based link) before broadcasting.
INSERT INTO newsletter (title, subtitle, body_md, theme, cta_label, cta_url, status, created_by)
VALUES (
    '⚽ La Ligue 1 arrive sur PronoCore !',
    'Score exact, classement, embrouilles de groupe... comme au Mondial, version championnat.',
    '## Le championnat de France débarque sur PronoCore ⚽🇫🇷

Après la Coupe du Monde et la F1, on prépare une nouvelle compétition : le **prono Ligue 1**, journée après journée.

Bientôt, pronostiquez le **score exact** de vos matchs de Ligue 1 préférés, suivez un classement dédié, et enchaînez les pronos entre deux Grands Prix 🏁

Une pensée émue pour le **FC Metz**, toujours au chevet de la Ligue 2 — on compte sur eux pour vite remonter et nous rejoindre au classement 🟥👋

Et pour nos amis de **Thionville**, tout juste passés professionnels : bravo pour l''exploit, mais entre la Ligue 3 et l''élite, il reste encore quelques étages à grimper. Courage, on garde une place au chaud 🪜⚽

**Bon à savoir** : comme pour la F1, c''est votre **admin de groupe** qui décide d''ajouter (ou non) la Ligue 1 au roster des compétitions pronostiquables. Allez lui glisser un mot si vous voulez en être dès le coup d''envoi !

⚽ On se retrouve sur le terrain !',
    'FOOTBALL',
    'Voir la rubrique Foot',
    '/foot',
    'DRAFT',
    'system'
);
