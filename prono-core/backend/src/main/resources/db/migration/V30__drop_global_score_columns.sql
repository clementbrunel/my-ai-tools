ALTER TABLE users
    DROP COLUMN IF EXISTS global_score,
    DROP COLUMN IF EXISTS bets_won,
    DROP COLUMN IF EXISTS forfeits_received;
