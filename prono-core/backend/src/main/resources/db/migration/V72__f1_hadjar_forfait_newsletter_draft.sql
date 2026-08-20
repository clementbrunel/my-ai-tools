-- Draft newsletter alerting players to a last-minute grid change before the
-- GP des Pays-Bas (round 14, qualifs 2026-08-22 / course 2026-08-23):
-- Isack Hadjar is out for medical reasons, Liam Lawson covers for him at
-- Red Bull for this race only, and Yuki Tsunoda takes over Lawson's Racing
-- Bulls seat for the same race. Ready to review and send from the admin
-- ⚙️ → Newsletters tab before qualifying opens. The CTA links to the race's
-- page (/f1/races/{id}), resolved here from round 14 of the 2026 season.
INSERT INTO newsletter (title, subtitle, body_md, theme, cta_label, cta_url, status, created_by)
SELECT
    '🏎️ Alerte grille avant le GP des Pays-Bas : forfait d''Hadjar',
    'Lawson chez Red Bull, Tsunoda chez Racing Bulls — le temps d''une course',
    '## Changement de dernière minute avant Zandvoort 🚨

Isack Hadjar est forfait pour le **GP des Pays-Bas** (qualifs samedi 22 août, course dimanche 23 août) pour raison médicale.

- 🔵 **Liam Lawson** quitte Racing Bulls pour prendre son volant chez **Red Bull**, le temps de cette course uniquement.
- ⚪ **Yuki Tsunoda** récupère le siège laissé vacant chez **Racing Bulls**.

Retour à la configuration habituelle dès le prochain Grand Prix.

**Avant de valider votre prono Podium+** (P1/P2/P3, pole, meilleur tour, lanterne rouge) pour ce GP, vérifiez bien la grille : vos picks habituels pourraient ne pas coller à la réalité du plateau ce week-end.

Pas d''inquiétude côté classement : pilotes et constructeurs restent calculés correctement sur la durée, écurie par écurie, course par course — ce changement ponctuel n''aura aucun impact sur le long terme.

🏁 Rendez-vous à Zandvoort !',
    'F1',
    'Voir le GP des Pays-Bas',
    '/f1/races/' || r.id::text,
    'DRAFT',
    'system'
FROM races r
JOIN competitions c ON c.id = r.competition_id
WHERE c.name = 'Formule 1 2026' AND r.round = 14;
