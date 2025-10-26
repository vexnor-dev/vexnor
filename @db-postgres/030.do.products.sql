begin;

create table valnor_test.product
(
    product_id   uuid         not null default gen_random_uuid(),
    created_at   timestamptz  not null default now(),
    modified_at  timestamptz  not null default now(),
    label        varchar(255) not null,
    price        decimal      not null,
    discount     decimal      null,
    is_available boolean      not null default true,
    is_published boolean      not null default false,
    metadata     jsonb,
    tags         text[],

    constraint product_pk primary key (product_id),
    constraint metadata_product_json_structure CHECK (
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
            (metadata ->> 'release_date') ~ '^\d{4}-\d{2}-\d{2}$'
        )
    )
);

commit;