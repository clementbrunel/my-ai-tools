-- V53__newsletter_mention_coref1_group.sql — Mention the new "Unité Core - F1" group
-- in the still-unsent F1 launch newsletter draft (V48), without editing that
-- already-applied migration in place.

UPDATE newsletter
SET body_md = REPLACE(
    body_md,
    'Rejoignez ou créez un groupe F1, et demandez à votre admin d''ouvrir le premier Grand Prix aux pronos !',
    'Rejoignez ou créez un groupe F1 — par exemple **Unité Core - F1** (code d''invitation `COREF12026`) — et demandez à votre admin d''ouvrir le premier Grand Prix aux pronos !'
)
WHERE theme = 'F1' AND status = 'DRAFT';
