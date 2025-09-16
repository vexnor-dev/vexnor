begin;

create table one_sql.product
(
    product_id   uuid         not null default gen_random_uuid(),
    created_at   timestamptz  not null default now(),
    modified_at  timestamptz  not null default now(),
    label        varchar(255) not null,
    price        decimal      not null,
    discount     decimal      null,
    is_available boolean      not null default true,
    is_published boolean      not null default false,

    constraint product_pk primary key (product_id)
);

commit;