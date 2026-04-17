-- user settings
create table if not exists user_settings (
  id                  uuid primary key references auth.users(id) on delete cascade,
  daily_goal          int not null default 20,
  last_completed_date date,
  created_at          timestamptz default now()
);

alter table user_settings enable row level security;

create policy "users manage own settings"
  on user_settings for all
  using (auth.uid() = id);

-- words (seed data, publicly readable)
create table if not exists words (
  id         serial primary key,
  english    text not null,
  korean_vi  text,
  korean_vt  text,
  type       text not null check (type in ('Vi', 'Vt')),
  pair_id    int
);

alter table words enable row level security;

create policy "words are public"
  on words for select
  using (true);

-- progress
create table if not exists progress (
  id                  serial primary key,
  user_id             uuid references auth.users(id) on delete cascade,
  word_id             int references words(id),
  error_count         int not null default 0,
  consecutive_correct int not null default 0,
  is_mastered         boolean not null default false,
  last_seen_date      date,
  updated_at          timestamptz default now(),
  unique(user_id, word_id)
);

alter table progress enable row level security;

create policy "users manage own progress"
  on progress for all
  using (auth.uid() = user_id);
