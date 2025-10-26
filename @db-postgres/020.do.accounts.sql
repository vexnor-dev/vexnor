begin;

create type valnor_test.account_status as enum ('created', 'confirmed', 'deleted');

create table valnor_test.account
(
    account_id  uuid                   not null default gen_random_uuid(),
    status      valnor_test.account_status not null default 'created',
    email       varchar(255)           not null,
    first_name  varchar(50)            not null,
    last_name   varchar(50)            not null,
    notes       text,
    created_at  timestamptz            not null default now(),
    modified_at timestamptz            not null default now(),
    parent_id   uuid,

    constraint account_pk primary key (account_id),
    constraint fk_account_parent foreign key (parent_id) references valnor_test.account (account_id) on delete set null
);

create index idx_account_parent_id on valnor_test.account (parent_id);

commit;