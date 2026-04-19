create table if not exists sentence_exercises (
  id serial primary key,
  chapter text not null,
  order_index integer not null,
  korean text not null,
  hints text[] not null default '{}',
  english text not null,
  created_at timestamptz not null default now()
);

create table if not exists sentence_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id integer not null references sentence_exercises(id) on delete cascade,
  attempt_count integer not null default 0,
  correct_count integer not null default 0,
  last_attempted_date date,
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create index if not exists idx_sentence_progress_user on sentence_progress(user_id);
