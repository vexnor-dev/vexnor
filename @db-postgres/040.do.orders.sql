begin;

create type vexnor_dev.order_status as enum ('created', 'paid', 'delivered', 'received');

create table vexnor_dev.order
(
    order_id    uuid                 not null default gen_random_uuid(),
    status      vexnor_dev.order_status not null default 'created',
    created_at  timestamptz          not null default now(),
    modified_at timestamptz          not null default now(),
    account_id  uuid                 not null,

    constraint order_pk primary key (order_id),
    constraint order_account_fk foreign key (account_id) references vexnor_dev.account (account_id)
);

create table vexnor_dev.order_item
(
    order_id       uuid        not null,
    product_id     uuid        not null,
    created_at     timestamptz not null default now(),
    modified_at    timestamptz not null default now(),
    product_price  decimal     not null,
    discount_price decimal,
    quantity       int         not null,
    metadata       jsonb,

    constraint order_item_pk primary key (order_id, product_id),
    constraint order_item_order_fk foreign key (order_id) references vexnor_dev.order (order_id),
    constraint order_item_product_fk foreign key (product_id) references vexnor_dev.product (product_id),
    constraint metadata_order_item_json_structure CHECK (
        metadata IS NULL OR (
            jsonb_typeof(metadata -> 'brand') = 'string' AND
            jsonb_typeof(metadata -> 'weight') = 'number' AND
            jsonb_typeof(metadata -> 'dimensions') = 'object' AND
            jsonb_typeof(metadata -> 'colors') = 'array' AND
            jsonb_typeof(metadata -> 'country_of_origin') = 'string' AND
            jsonb_typeof(metadata -> 'release_date') = 'string' AND
            jsonb_typeof(metadata -> 'is_recyclable') = 'boolean' AND
            -- Check dimensions object
            jsonb_typeof(metadata -> 'dimensions' -> 'width') = 'number' AND
            jsonb_typeof(metadata -> 'dimensions' -> 'height') = 'number' AND
            jsonb_typeof(metadata -> 'dimensions' -> 'depth') = 'number' AND
            -- Check release_date format (YYYY-MM-DD)
            (metadata ->> 'release_date') ~ '^\\d{4}-\\d{2}-\\d{2}$'
        )
    )
);

commit;