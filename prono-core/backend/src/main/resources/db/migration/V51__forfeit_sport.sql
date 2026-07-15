-- V51__forfeit_sport.sql — Tag shared gages with a sport so F1 groups don't
-- see football-only forfeits (jersey, anthem, "but adverse", etc).
-- NULL = generic gage, shown to every sport.

ALTER TABLE forfeits ADD COLUMN sport VARCHAR(10);

UPDATE forfeits SET sport = 'FOOT' WHERE title IN (
    '📸 Photo ridicule imposée',
    '🎤 Chanter l''hymne adverse',
    '🎬 Vidéo gênante',
    '🗣️ Blague nulle obligatoire',
    '🖥️ Fond d''écran honteux',
    '📝 Signature mail honteuse',
    '🎙️ Discours de défaite',
    '🗳️ Compliment forcé',
    '📊 Slide de la honte',
    '🏅 Photo de profil adverse',
    '🧠 Quiz foot raté'
);
