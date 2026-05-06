begin;

create type vexnor_dev.account_status as enum ('created', 'confirmed', 'deleted');

create table vexnor_dev.account
(
    account_id  uuid                   not null default gen_random_uuid(),
    status      vexnor_dev.account_status not null default 'created',
    email       varchar(255)           not null,
    first_name  varchar(50)            not null,
    last_name   varchar(50)            not null,
    notes       text,
    created_at  timestamptz            not null default now(),
    modified_at timestamptz            not null default now(),
    parent_id   uuid,

    constraint account_pk primary key (account_id),
    constraint fk_account_parent foreign key (parent_id) references vexnor_dev.account (account_id) on delete set null
);

create index idx_account_parent_id on vexnor_dev.account (parent_id);

commit;