-- Newsletter (campagnes one-shot pour annoncer les grosses features en prod).
-- Séparé des templates transactionnels : contenu rédigé par l'admin, persisté,
-- diffusé en une fois puis figé (status SENT).

CREATE TABLE newsletter (
    id           BIGSERIAL PRIMARY KEY,
    title        VARCHAR(200)  NOT NULL,
    subtitle     VARCHAR(200),
    body_md      TEXT          NOT NULL,
    theme        VARCHAR(20)   NOT NULL DEFAULT 'FOOTBALL',
    cta_label    VARCHAR(100),
    cta_url      VARCHAR(500),
    status       VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    sent_count   INTEGER       NOT NULL DEFAULT 0,
    created_by   VARCHAR(100),
    created_at   TIMESTAMP     NOT NULL DEFAULT now(),
    sent_at      TIMESTAMP
);

-- Opt-out dédié à la newsletter, indépendant des rappels de match / gages.
ALTER TABLE users
    ADD COLUMN email_newsletter_enabled BOOLEAN NOT NULL DEFAULT true;
