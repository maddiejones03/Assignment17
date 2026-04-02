#!/usr/bin/env python3
"""
One-shot migration: SQLite shop.db -> Supabase Postgres.

Usage:
  export SUPABASE_DB_URL="postgresql://postgres:...sslmode=require"
  python scripts/migrate_sqlite_to_supabase.py

Optional env vars:
  SQLITE_PATH=../shop.db
  TRUNCATE_FIRST=true
"""

from __future__ import annotations

import os
import sqlite3
from typing import Dict, List, Sequence

import psycopg
from psycopg import sql

TABLES_IN_ORDER: List[str] = [
    "customers",
    "products",
    "orders",
    "order_items",
    "product_reviews",
    "shipments",
]

PK_BY_TABLE: Dict[str, str] = {
    "customers": "customer_id",
    "products": "product_id",
    "orders": "order_id",
    "order_items": "order_item_id",
    "product_reviews": "review_id",
    "shipments": "shipment_id",
}


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "y", "on"}


def get_sqlite_columns(conn: sqlite3.Connection, table: str) -> List[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    if not rows:
        raise RuntimeError(f"Table not found in SQLite: {table}")
    return [row[1] for row in rows]


def get_postgres_columns(pg: psycopg.Connection, table: str) -> List[str]:
    query = """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
    """
    with pg.cursor() as cur:
        cur.execute(query, (table,))
        rows = cur.fetchall()
    if not rows:
        raise RuntimeError(f"Table not found in Postgres public schema: {table}")
    return [r[0] for r in rows]


def fetch_sqlite_rows(
    sqlite_conn: sqlite3.Connection, table: str, columns: Sequence[str]
) -> List[tuple]:
    col_list = ", ".join(columns)
    return sqlite_conn.execute(f"SELECT {col_list} FROM {table}").fetchall()


def truncate_table(pg: psycopg.Connection, table: str) -> None:
    with pg.cursor() as cur:
        cur.execute(
            sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE").format(
                sql.Identifier(table)
            )
        )


def insert_rows(
    pg: psycopg.Connection, table: str, columns: Sequence[str], rows: Sequence[tuple]
) -> int:
    if not rows:
        return 0
    insert_sql = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
        sql.Identifier(table),
        sql.SQL(", ").join(sql.Identifier(c) for c in columns),
        sql.SQL(", ").join(sql.Placeholder() for _ in columns),
    )
    with pg.cursor() as cur:
        cur.executemany(insert_sql, rows)
    return len(rows)


def set_sequence_to_max(pg: psycopg.Connection, table: str, pk_col: str) -> None:
    # Safe no-op if table/column is not tied to a sequence.
    query = """
        SELECT pg_get_serial_sequence(%s, %s)
    """
    with pg.cursor() as cur:
        cur.execute(query, (f"public.{table}", pk_col))
        sequence_name = cur.fetchone()[0]
        if not sequence_name:
            return
        cur.execute(
            sql.SQL(
                "SELECT setval(%s, COALESCE((SELECT MAX({pk}) FROM {table}), 1), true)"
            ).format(pk=sql.Identifier(pk_col), table=sql.Identifier(table)),
            (sequence_name,),
        )


def count_rows_sqlite(sqlite_conn: sqlite3.Connection, table: str) -> int:
    return int(sqlite_conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])


def count_rows_pg(pg: psycopg.Connection, table: str) -> int:
    with pg.cursor() as cur:
        cur.execute(
            sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table))
        )
        return int(cur.fetchone()[0])


def main() -> None:
    sqlite_path = os.getenv("SQLITE_PATH", "../shop.db")
    pg_url = require_env("SUPABASE_DB_URL")
    truncate_first = bool_env("TRUNCATE_FIRST", default=True)

    print(f"SQLite source: {sqlite_path}")
    print("Target: Supabase Postgres")
    print(f"TRUNCATE_FIRST={truncate_first}")

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    with psycopg.connect(pg_url) as pg_conn:
        for table in TABLES_IN_ORDER:
            sqlite_cols = get_sqlite_columns(sqlite_conn, table)
            pg_cols = get_postgres_columns(pg_conn, table)

            missing_in_pg = [c for c in sqlite_cols if c not in pg_cols]
            if missing_in_pg:
                raise RuntimeError(
                    f"Postgres table '{table}' missing columns from SQLite: {missing_in_pg}"
                )

            # Insert common columns only; supports extra columns in Postgres.
            common_cols = [c for c in sqlite_cols if c in pg_cols]
            rows = fetch_sqlite_rows(sqlite_conn, table, common_cols)

            if truncate_first:
                truncate_table(pg_conn, table)

            inserted = insert_rows(pg_conn, table, common_cols, rows)
            print(f"[{table}] inserted: {inserted}")

        # Sequence fix for explicit ID inserts
        for table, pk in PK_BY_TABLE.items():
            set_sequence_to_max(pg_conn, table, pk)

        pg_conn.commit()

        print("\nRow-count verification:")
        for table in TABLES_IN_ORDER:
            sqlite_n = count_rows_sqlite(sqlite_conn, table)
            pg_n = count_rows_pg(pg_conn, table)
            status = "OK" if sqlite_n == pg_n else "MISMATCH"
            print(f"- {table}: sqlite={sqlite_n} pg={pg_n} [{status}]")

    sqlite_conn.close()
    print("\nMigration complete.")


if __name__ == "__main__":
    main()
