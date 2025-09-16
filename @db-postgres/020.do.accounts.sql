begin;

create type one_sql.account_status as enum ('created', 'confirmed', 'deleted');

create table one_sql.account
(
    account_id  uuid                   not null default gen_random_uuid(),
    status      one_sql.account_status not null default 'created',
    email       varchar(255)           not null,
    first_name  varchar(50)            not null,
    last_name   varchar(50)            not null,
    notes       text,
    created_at  timestamptz            not null default now(),
    modified_at timestamptz            not null default now(),

    constraint account_pk primary key (account_id)
);

commit;