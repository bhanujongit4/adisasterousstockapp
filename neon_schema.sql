-- Run this in Neon SQL Editor

create table if not exists app_user (
  id bigserial primary key,
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists app_user_email_unique
  on app_user (lower(email));

create table if not exists user_watchlist (
  id bigserial primary key,
  user_id bigint not null references app_user(id) on delete cascade,
  symbol text not null,
  created_at timestamptz not null default now(),
  constraint user_watchlist_symbol_format check (symbol = upper(symbol) and length(symbol) <= 12),
  constraint user_watchlist_unique unique (user_id, symbol)
);

create index if not exists user_watchlist_user_idx
  on user_watchlist (user_id);
