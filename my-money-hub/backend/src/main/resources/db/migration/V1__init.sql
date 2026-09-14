CREATE TABLE institutions (
    id                BIGSERIAL PRIMARY KEY,
    name              VARCHAR(100) NOT NULL,
    type              VARCHAR(20)  NOT NULL,
    connector_type    VARCHAR(20)  NOT NULL,
    external_ref      VARCHAR(100),
    created_at        TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
    id                    BIGSERIAL PRIMARY KEY,
    institution_id        BIGINT       NOT NULL REFERENCES institutions(id),
    label                 VARCHAR(150) NOT NULL,
    iban                  VARCHAR(34),
    currency              VARCHAR(3)   NOT NULL DEFAULT 'EUR',
    type                  VARCHAR(20)  NOT NULL,
    current_balance       NUMERIC(14, 2) NOT NULL DEFAULT 0,
    external_account_id   VARCHAR(150),
    last_synced_at        TIMESTAMP,
    created_at            TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_institution ON accounts(institution_id);

CREATE TABLE balance_snapshots (
    id            BIGSERIAL PRIMARY KEY,
    account_id    BIGINT NOT NULL REFERENCES accounts(id),
    balance       NUMERIC(14, 2) NOT NULL,
    recorded_at   TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_balance_snapshots_account ON balance_snapshots(account_id, recorded_at);

CREATE TABLE transactions (
    id             BIGSERIAL PRIMARY KEY,
    account_id     BIGINT NOT NULL REFERENCES accounts(id),
    booking_date   DATE NOT NULL,
    amount         NUMERIC(14, 2) NOT NULL,
    currency       VARCHAR(3) NOT NULL DEFAULT 'EUR',
    description    VARCHAR(500),
    category       VARCHAR(100),
    external_id    VARCHAR(150),
    created_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_account ON transactions(account_id, booking_date);
CREATE UNIQUE INDEX uq_transactions_external ON transactions(account_id, external_id) WHERE external_id IS NOT NULL;
