alter table words add column if not exists level text not null default 'beginner';
alter table user_settings add column if not exists current_level text not null default 'beginner';
