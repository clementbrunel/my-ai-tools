-- Archived accounts: closed accounts kept only for their history (imported from Linxo), excluded from net worth.
ALTER TABLE accounts ADD COLUMN archived BOOLEAN NOT NULL DEFAULT false;

-- Where a row came from: connector sync (SYNC) or Linxo CSV import (LINXO). Lets the import yield to the sync on
-- overlapping periods and regenerate its own balance history without touching synced data.
ALTER TABLE transactions ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'SYNC';
ALTER TABLE balance_snapshots ADD COLUMN source VARCHAR(10) NOT NULL DEFAULT 'SYNC';

CREATE INDEX idx_transactions_account_source ON transactions(account_id, source);
CREATE INDEX idx_balance_snapshots_account_source ON balance_snapshots(account_id, source);
