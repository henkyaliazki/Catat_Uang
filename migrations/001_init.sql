-- ============================================================
-- Migration 001: Initial Schema — CatatUang
-- ============================================================

-- ── Users ───────────────────────────────────────────────────
CREATE TABLE users (
    id          SERIAL          PRIMARY KEY,
    wa_number   VARCHAR(20)     UNIQUE NOT NULL,
    nama        VARCHAR(100),
    jwt_token   TEXT,
    created_at  TIMESTAMPTZ     DEFAULT NOW()
);

-- ── Categories ──────────────────────────────────────────────
CREATE TABLE categories (
    id      SERIAL      PRIMARY KEY,
    nama    VARCHAR(50) NOT NULL,
    icon    VARCHAR(10),
    color   VARCHAR(7)
);

-- ── Expenses ────────────────────────────────────────────────
CREATE TABLE expenses (
    id                      SERIAL          PRIMARY KEY,
    user_id                 INT             NOT NULL REFERENCES users(id),
    category_id             INT             REFERENCES categories(id),
    nama                    VARCHAR(100)    NOT NULL,
    jumlah                  BIGINT          NOT NULL,
    sumber                  VARCHAR(10)     DEFAULT 'teks',
    tanggal                 TIMESTAMPTZ     DEFAULT NOW(),
    raw_input               TEXT,
    raw_input_deleted_at    TIMESTAMPTZ,
    image_url               TEXT,
    image_deleted_at        TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     DEFAULT NOW()
);

-- ── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_tanggal ON expenses(tanggal);
CREATE INDEX idx_users_wa_number  ON users(wa_number);
