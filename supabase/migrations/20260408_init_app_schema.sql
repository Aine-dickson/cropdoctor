-- Shared Coffee Clinic / CropDoctor schema.
-- Safe to rebuild from scratch in a non-production environment.

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.notification_outbox cascade;
drop table if exists public.app_logs cascade;
drop table if exists public.reviews cascade;
drop table if exists public.detections cascade;
drop table if exists public.transactions cascade;
drop table if exists public.orders cascade;
drop table if exists public.products cascade;
drop table if exists public.suppliers cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_order_payment();
drop function if exists public.sync_order_fields();
drop function if exists public.prevent_profile_privilege_escalation();
drop function if exists public.notify_profile_account_events();
drop function if exists public.queue_account_notification(text, text, jsonb, uuid);
drop function if exists public.handle_new_user();
drop function if exists public.set_updated_at();
drop function if exists public.can_access_admin();
drop function if exists public.can_start_admin_login(text);
drop function if exists public.sync_supplier_from_profile();
drop function if exists public.supplier_order_access(jsonb);
drop function if exists public.prevent_supplier_order_update();
drop function if exists public.current_role();
drop function if exists public.is_admin();
drop function if exists public.is_staff();
drop function if exists public.is_supplier();

create extension if not exists pgcrypto;

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    name text,
    phone text,
    email text,
    address text,
    region text,
    role text not null default 'farmer' check (role in ('admin', 'co_admin', 'supplier', 'farmer')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.suppliers (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid references public.profiles(id) on delete set null,
    business_name text not null,
    contact_phone text,
    email text,
    region text not null,
    location text not null,
    is_verified boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.products (
    id serial primary key,
    name text not null,
    description text,
    type text not null,
    category text not null default 'fungicide' check (category in ('fungicide', 'insecticide', 'herbicide', 'fertilizer', 'other')),
    emoji text not null default '🟡',
    price numeric(12, 2) not null check (price >= 0),
    stock_qty integer not null default 0 check (stock_qty >= 0),
    unit text not null default 'packet',
    supplier_id uuid references public.suppliers(id) on delete set null,
    treats text[] not null default '{}',
    diseases text[] not null default '{}',
    application text,
    dosage text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.orders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete set null,
    items jsonb not null default '[]'::jsonb,
    subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
    delivery_fee numeric(12, 2) not null default 5000 check (delivery_fee >= 0),
    total numeric(12, 2) not null check (total >= 0),
    location text not null,
    payment text not null check (payment in ('mtn', 'airtel', 'cod')),
    payment_method text not null check (payment_method in ('mtn', 'airtel', 'cod')),
    payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
    momo_number text,
    status text not null default 'placed' check (status in ('placed', 'confirmed', 'dispatched', 'delivered', 'cancelled')),
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.transactions (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references public.orders(id) on delete set null,
    user_id uuid references public.profiles(id) on delete set null,
    type text not null default 'payment' check (type in ('payment', 'refund', 'adjustment')),
    amount numeric(12, 2) not null check (amount >= 0),
    payment_method text check (payment_method in ('mtn', 'airtel', 'cod')),
    momo_number text,
    reference text,
    status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
    created_at timestamptz not null default now()
);

create table public.detections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete set null,
    disease text not null,
    plant text,
    confidence integer check (confidence between 0 and 100),
    severity text,
    source text not null default 'scan' check (source in ('scan', 'describe', 'search')),
    created_at timestamptz not null default now()
);

create table public.reviews (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete cascade,
    product_id integer not null references public.products(id) on delete cascade,
    rating integer not null check (rating between 1 and 5),
    comment text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, product_id)
);

create table public.app_logs (
    id uuid primary key default gen_random_uuid(),
    level text not null default 'info' check (level in ('info', 'warn', 'error', 'debug')),
    context text not null,
    message text not null,
    metadata jsonb,
    user_id uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create table public.notification_outbox (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete set null,
    channel text not null default 'email' check (channel in ('email', 'sms')),
    recipient text not null,
    template_key text not null,
    payload jsonb not null default '{}'::jsonb,
    status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
    retry_count integer not null default 0,
    last_error text,
    sent_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_active_idx on public.profiles(is_active);
create index if not exists suppliers_profile_id_idx on public.suppliers(profile_id);
create index if not exists suppliers_verified_idx on public.suppliers(is_verified);
create index if not exists products_supplier_idx on public.products(supplier_id);
create index if not exists products_category_idx on public.products(category);
create index if not exists products_active_idx on public.products(is_active);
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_payment_status_idx on public.orders(payment_status);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists transactions_order_idx on public.transactions(order_id);
create index if not exists transactions_user_idx on public.transactions(user_id);
create index if not exists detections_user_id_idx on public.detections(user_id);
create index if not exists reviews_product_idx on public.reviews(product_id);
create index if not exists app_logs_level_idx on public.app_logs(level);
create index if not exists app_logs_created_idx on public.app_logs(created_at desc);
create index if not exists notification_outbox_status_idx on public.notification_outbox(status);
create index if not exists notification_outbox_created_idx on public.notification_outbox(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, phone)
    values (new.id, new.email, new.phone)
    on conflict (id) do nothing;
    return new;
end;
$$;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_staff() and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
        raise exception 'Only staff can change role or active status';
    end if;
    return new;
end;
$$;

create or replace function public.queue_account_notification(
    recipient_email text,
    notification_template text,
    notification_payload jsonb default '{}'::jsonb,
    profile_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    normalized_email text := lower(trim(coalesce(recipient_email, '')));
    created_id uuid;
begin
    if normalized_email = '' or position('@' in normalized_email) = 0 then
        return null;
    end if;

    insert into public.notification_outbox (user_id, channel, recipient, template_key, payload)
    values (profile_id, 'email', normalized_email, notification_template, coalesce(notification_payload, '{}'::jsonb))
    returning id into created_id;

    return created_id;
end;
$$;

create or replace function public.notify_profile_account_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if coalesce(new.email, '') = '' then
        return new;
    end if;

    if tg_op = 'INSERT' then
        if new.is_active and new.role in ('admin', 'supplier') then
            perform public.queue_account_notification(
                new.email,
                'account_created',
                jsonb_build_object(
                    'name', coalesce(new.name, ''),
                    'role', new.role,
                    'event', 'created'
                ),
                new.id
            );
        end if;
        return new;
    end if;

    if tg_op = 'UPDATE' and coalesce(new.is_active, false) and coalesce(old.is_active, false) then
        if old.role not in ('admin', 'supplier') and new.role in ('admin', 'supplier') then
            perform public.queue_account_notification(
                new.email,
                'role_elevated',
                jsonb_build_object(
                    'name', coalesce(new.name, ''),
                    'role', new.role,
                    'previous_role', old.role,
                    'event', 'elevated'
                ),
                new.id
            );
        elsif old.role in ('admin', 'supplier') and new.role in ('admin', 'supplier') and old.role is distinct from new.role then
            perform public.queue_account_notification(
                new.email,
                'role_switched',
                jsonb_build_object(
                    'name', coalesce(new.name, ''),
                    'role', new.role,
                    'previous_role', old.role,
                    'event', 'switched'
                ),
                new.id
            );
        end if;
    end if;

    return new;
end;
$$;

create or replace function public.sync_order_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    new.payment_method := coalesce(new.payment_method, new.payment);
    new.payment := coalesce(new.payment, new.payment_method);
    new.delivery_fee := coalesce(new.delivery_fee, 5000);
    new.subtotal := coalesce(new.subtotal, greatest(coalesce(new.total, 0) - coalesce(new.delivery_fee, 0), 0));
    new.total := coalesce(new.total, new.subtotal + new.delivery_fee);
    return new;
end;
$$;

create or replace function public.handle_order_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.payment_status = 'paid' and (tg_op = 'INSERT' or coalesce(old.payment_status, '') <> 'paid') then
        insert into public.transactions (order_id, user_id, type, amount, payment_method, momo_number, status)
        values (new.id, new.user_id, 'payment', new.total, new.payment_method, new.momo_number, 'paid');
    end if;

    return new;
end;
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select role
    from public.profiles
    where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(role = 'admin', false)
    from public.profiles
    where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(role in ('admin', 'co_admin'), false)
    from public.profiles
    where id = auth.uid();
$$;

create or replace function public.is_supplier()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(role = 'supplier', false)
    from public.profiles
    where id = auth.uid();
$$;

create or replace function public.can_access_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(role in ('admin', 'co_admin', 'supplier'), false)
    from public.profiles
    where id = auth.uid();
$$;

create or replace function public.can_start_admin_login(identifier text)
returns table (allowed boolean, reason text, role text)
language sql
stable
security definer
set search_path = public
as $$
    with input as (
        select
            coalesce(trim(identifier), '') as raw,
            lower(coalesce(trim(identifier), '')) as lookup_email,
            regexp_replace(coalesce(trim(identifier), ''), '\\D', '', 'g') as lookup_phone_digits
    ),
    matched as (
        select p.role, p.is_active
        from input i
        join public.profiles p
            on (
                (position('@' in i.raw) > 0 and lower(coalesce(p.email, '')) = i.lookup_email)
                or
                (position('@' in i.raw) = 0 and i.lookup_phone_digits <> '' and regexp_replace(coalesce(p.phone, ''), '\\D', '', 'g') = i.lookup_phone_digits)
            )
        limit 1
    )
    select
        case
            when i.raw = '' then false
            when position('@' in i.raw) = 0 and i.lookup_phone_digits = '' then false
            when m.role is null then false
            when m.is_active is false then false
            when m.role not in ('admin', 'co_admin', 'supplier') then false
            else true
        end as allowed,
        case
            when i.raw = '' then 'Enter a registered email address or phone number.'
            when position('@' in i.raw) = 0 and i.lookup_phone_digits = '' then 'Enter a valid phone number.'
            when m.role is null then 'Access denied.'
            when m.is_active is false then 'This account has been deactivated.'
            when m.role not in ('admin', 'co_admin', 'supplier') then 'Access denied.'
            else null
        end as reason,
        m.role
    from input i
    left join matched m on true;
$$;

create or replace function public.sync_supplier_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    supplier_business_name text;
    supplier_region text;
    supplier_location text;
begin
    if new.role <> 'supplier' then
        return new;
    end if;

    supplier_business_name := coalesce(nullif(trim(coalesce(new.name, '')), ''), 'Supplier ' || left(new.id::text, 8));
    supplier_region := coalesce(nullif(trim(coalesce(new.region, '')), ''), 'Unknown');
    supplier_location := coalesce(nullif(trim(coalesce(new.address, '')), ''), supplier_region);

    update public.suppliers
    set
        business_name = supplier_business_name,
        contact_phone = coalesce(new.phone, contact_phone),
        email = coalesce(new.email, email),
        region = supplier_region,
        location = supplier_location,
        updated_at = now()
    where profile_id = new.id;

    if not found then
        insert into public.suppliers (
            profile_id,
            business_name,
            contact_phone,
            email,
            region,
            location,
            is_verified
        ) values (
            new.id,
            supplier_business_name,
            nullif(trim(coalesce(new.phone, '')), ''),
            nullif(lower(trim(coalesce(new.email, ''))), ''),
            supplier_region,
            supplier_location,
            false
        );
    end if;

    return new;
end;
$$;

create or replace function public.supplier_order_access(order_items jsonb)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from jsonb_array_elements(coalesce(order_items, '[]'::jsonb)) item
        join public.products p on p.id = (item->>'product_id')::integer
        join public.suppliers s on s.id = p.supplier_id
        where s.profile_id = auth.uid()
    );
$$;

create or replace function public.prevent_supplier_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if public.is_supplier() then
        if not public.supplier_order_access(old.items) then
            raise exception 'Suppliers can only update orders containing their products';
        end if;

        if new.status <> 'dispatched' or old.status not in ('placed', 'confirmed') then
            raise exception 'Suppliers can only move placed or confirmed orders to dispatched';
        end if;

        if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
            raise exception 'Suppliers can only update order status';
        end if;
    end if;

    return new;
end;
$$;

alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.transactions enable row level security;
alter table public.detections enable row level security;
alter table public.reviews enable row level security;
alter table public.app_logs enable row level security;
alter table public.notification_outbox enable row level security;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger prevent_profile_privilege_escalation before update on public.profiles for each row execute function public.prevent_profile_privilege_escalation();
create trigger notify_profile_account_events after insert or update of role, is_active, email, name on public.profiles for each row execute function public.notify_profile_account_events();
create trigger sync_supplier_from_profile after insert or update of role, name, phone, email, region, address on public.profiles for each row execute function public.sync_supplier_from_profile();
create trigger set_suppliers_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger set_products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger sync_order_fields before insert or update on public.orders for each row execute function public.sync_order_fields();
create trigger prevent_supplier_order_update before update on public.orders for each row execute function public.prevent_supplier_order_update();
create trigger set_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger on_order_paid after insert or update of payment_status on public.orders for each row execute function public.handle_order_payment();
create trigger set_reviews_updated_at before update on public.reviews for each row execute function public.set_updated_at();

create policy "profiles own read" on public.profiles for select using (auth.uid() = id or public.is_staff());
create policy "profiles own insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles own update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles staff update" on public.profiles for update using (public.is_staff()) with check (public.is_staff());

create policy "suppliers public read" on public.suppliers for select using (true);
create policy "suppliers staff manage" on public.suppliers for all using (public.is_staff()) with check (public.is_staff());
create policy "suppliers own update" on public.suppliers for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "products read active" on public.products for select using (is_active = true or public.is_staff() or supplier_id in (select id from public.suppliers where profile_id = auth.uid()));
create policy "products staff manage" on public.products for all using (public.is_staff()) with check (public.is_staff());
create policy "products supplier manage" on public.products for all using (supplier_id in (select id from public.suppliers where profile_id = auth.uid())) with check (supplier_id in (select id from public.suppliers where profile_id = auth.uid()));

create policy "orders own read" on public.orders for select using (user_id = auth.uid() or public.is_staff());
create policy "orders own insert" on public.orders for insert with check (user_id = auth.uid());
create policy "orders staff manage" on public.orders for all using (public.is_staff()) with check (public.is_staff());
create policy "orders supplier read" on public.orders for select using (public.is_supplier() and public.supplier_order_access(items));
create policy "orders supplier update" on public.orders for update using (public.is_supplier() and public.supplier_order_access(items)) with check (public.is_supplier() and public.supplier_order_access(items));

create policy "transactions own read" on public.transactions for select using (user_id = auth.uid() or public.is_staff());
create policy "transactions staff insert" on public.transactions for insert with check (public.is_staff());
create policy "transactions supplier read" on public.transactions for select using (
    public.is_supplier()
    and exists (
        select 1
        from public.orders o
        where o.id = public.transactions.order_id
          and public.supplier_order_access(o.items)
    )
);

create policy "detections own read" on public.detections for select using (user_id = auth.uid() or public.is_staff());
create policy "detections own insert" on public.detections for insert with check (user_id = auth.uid());

create policy "reviews public read" on public.reviews for select using (true);
create policy "reviews owner manage" on public.reviews for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "app logs admin read" on public.app_logs for select using (public.is_admin());
create policy "app logs insert" on public.app_logs for insert with check (true);

create policy "notification outbox staff read" on public.notification_outbox for select using (public.is_staff());