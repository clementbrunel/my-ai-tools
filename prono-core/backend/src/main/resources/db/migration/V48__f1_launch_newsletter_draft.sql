-- Draft newsletter announcing the F1 betting mode, ready to review and send
-- from the admin ⚙️ → Newsletters tab once the F1 CTA URL is known.
INSERT INTO newsletter (title, subtitle, body_md, theme, status, created_by)
VALUES (
    '🏎️ Les paris F1 arrivent sur PronoCore !',
    'Pole position, podium, meilleur tour... à vous de jouer.',
    '## La F1 débarque sur PronoCore 🏁

Après la Coupe du Monde, on lance un tout nouveau mode de paris : le **prono Podium+** sur chaque Grand Prix de la saison.

À chaque course, pronostiquez :

- 🥇🥈🥉 le **podium** (P1, P2, P3)
- ⏱ la **pole position** (verrouillée dès les qualifs)
- 🟣 le **meilleur tour**
- 🔦 la **lanterne rouge** (le dernier classé)

Chaque pick rapporte des points, avec un bonus **Grand Chelem** si vous enchaînez pole + victoire + meilleur tour sur la même course. Retrouvez aussi un classement pilotes et constructeurs mis à jour automatiquement après chaque Grand Prix, et la fiche détaillée de chaque pilote avec son historique course par course.

Rejoignez ou créez un groupe F1, et demandez à votre admin d''ouvrir le premier Grand Prix aux pronos !

À vos marques 🏎️',
    'F1',
    'DRAFT',
    'system'
);
