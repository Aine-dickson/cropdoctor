-- App schema for Coffee Clinic
-- Safe to run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    name text,
    address text,
    phone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    items jsonb not null default '[]' :: jsonb,
    total numeric(12, 2) not null check (total >= 0),
    location text not null,
    payment text not null check (payment in ('mtn', 'airtel', 'cod')),
    status text not null default 'placed' check (
        status in ('placed', 'pending', 'delivered', 'cancelled')
    ),
    created_at timestamptz not null default now()
);

create table if not exists public.detections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    disease text not null,
    plant text not null,
    confidence integer not null check (
        confidence between 0
        and 100
    ),
    severity text check (
        severity is null
        or severity in ('low', 'medium', 'high')
    ),
    created_at timestamptz not null default now()
);

create table if not exists public.reviews (
    user_id uuid not null references auth.users(id) on delete cascade,
    product_id text not null,
    rating integer not null check (
        rating between 1
        and 5
    ),
    comment text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, product_id)
);

create index if not exists idx_orders_user_created_at on public.orders (user_id, created_at desc);

create index if not exists idx_detections_user_created_at on public.detections (user_id, created_at desc);

create index if not exists idx_reviews_product on public.reviews (product_id);

create
or replace function public.set_updated_at() returns trigger language plpgsql as $ $ begin new.updated_at = now();

return new;

end;

$ $;

drop trigger if exists set_profiles_updated_at on public.profiles;

create trigger set_profiles_updated_at before
update
    on public.profiles for each row execute procedure public.set_updated_at();

drop trigger if exists set_reviews_updated_at on public.reviews;

create trigger set_reviews_updated_at before
update
    on public.reviews for each row execute procedure public.set_updated_at();

alter table
    public.profiles enable row level security;

alter table
    public.orders enable row level security;

alter table
    public.detections enable row level security;

alter table
    public.reviews enable row level security;

-- Profiles policies
drop policy if exists "profiles owner select" on public.profiles;

create policy "profiles owner select" on public.profiles for
select
    using (auth.uid() = id);

drop policy if exists "profiles owner insert" on public.profiles;

create policy "profiles owner insert" on public.profiles for
insert
    with check (auth.uid() = id);

drop policy if exists "profiles owner update" on public.profiles;

create policy "profiles owner update" on public.profiles for
update
    using (auth.uid() = id) with check (auth.uid() = id);

-- Orders policies
drop policy if exists "orders owner select" on public.orders;

create policy "orders owner select" on public.orders for
select
    using (auth.uid() = user_id);

drop policy if exists "orders owner insert" on public.orders;

create policy "orders owner insert" on public.orders for
insert
    with check (auth.uid() = user_id);

-- Detections policies
drop policy if exists "detections owner select" on public.detections;

create policy "detections owner select" on public.detections for
select
    using (auth.uid() = user_id);

drop policy if exists "detections owner insert" on public.detections;

create policy "detections owner insert" on public.detections for
insert
    with check (auth.uid() = user_id);

-- Reviews policies
drop policy if exists "reviews owner select" on public.reviews;

create policy "reviews owner select" on public.reviews for
select
    using (auth.uid() = user_id);

drop policy if exists "reviews owner insert" on public.reviews;

create policy "reviews owner insert" on public.reviews for
insert
    with check (auth.uid() = user_id);

drop policy if exists "reviews owner update" on public.reviews;

create policy "reviews owner update" on public.reviews for
update
    using (auth.uid() = user_id) with check (auth.uid() = user_id);