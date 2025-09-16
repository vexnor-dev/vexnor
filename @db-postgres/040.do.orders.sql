begin;

create type one_sql.order_status as enum ('created', 'paid', 'delivered', 'received');

create table one_sql.order
(
    order_id    uuid                 not null default gen_random_uuid(),
    status      one_sql.order_status not null default 'created',
    created_at  timestamptz          not null,
    modified_at timestamptz          not null,
    account_id  uuid                 not null,

    constraint order_pk primary key (order_id),
    constraint order_account_fk foreign key (account_id) references one_sql.account (account_id)
);

create table one_sql.order_item
(
    order_item_id  uuid        not null default gen_random_uuid(),
    created_at      timestamptz not null,
    modified_at     timestamptz not null,
    order_id       uuid        not null,
    product_id     uuid        not null,
    product_price  decimal     not null,
    discount_price decimal,
    quantity       int         not null,

    constraint order_item_pk primary key (order_item_id),
    constraint order_item_order_fk foreign key (order_id) references one_sql.order (order_id),
    constraint order_item_product_fk foreign key (product_id) references one_sql.product (product_id)
);

commit;