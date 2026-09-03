"""
database.py — Phase 1: SQLite Schema for RecoverPay AI Revenue Recovery Agent.

Tables
------
- transactions : Every failed payment that the agent will attempt to recover.
- audit_logs   : Immutable log of every action the agent takes on a transaction.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "recoverpay.db")


def get_connection() -> sqlite3.Connection:
    """Return a connection to the SQLite database with foreign-key support."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create (or re-create) the transactions and audit_logs tables."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript(
        """
        CREATE TABLE IF NOT EXISTS transactions (
            id                  TEXT        PRIMARY KEY,
            customer_name       TEXT        NOT NULL,
            phone               TEXT        NOT NULL,
            amount_inr          REAL        NOT NULL,
            failure_code        TEXT        NOT NULL,
            failure_description TEXT        NOT NULL,
            preferred_language  TEXT        NOT NULL,
            status              TEXT        NOT NULL DEFAULT 'FAILED',
            attempt_count       INTEGER     NOT NULL DEFAULT 0,
            max_attempts        INTEGER     NOT NULL DEFAULT 2,
            payment_link        TEXT,
            promise_to_pay_date TEXT,
            created_at          TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id              INTEGER     PRIMARY KEY AUTOINCREMENT,
            transaction_id  TEXT        NOT NULL,
            stage           TEXT        NOT NULL,
            action_taken    TEXT        NOT NULL,
            reasoning       TEXT,
            timestamp       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (transaction_id) REFERENCES transactions (id)
        );
        """
    )

    conn.commit()
    conn.close()
    print(f"[OK] Database initialised -> {DB_PATH}")


if __name__ == "__main__":
    init_db()