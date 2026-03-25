begin;

create table valnor_test.type_coverage
(
    -- string types
    col_uuid        uuid            not null default gen_random_uuid(),
    col_text        text            not null,
    col_varchar     varchar(255)    not null,
    col_bpchar      char(10)        not null,
    col_json        json,
    col_jsonb       jsonb,
    col_xml         xml,
    col_inet        inet,
    col_cidr        cidr,
    col_macaddr     macaddr,
    col_bit         bit(8),
    col_varbit      varbit(8),
    col_interval    interval,
    col_time        time,
    col_timetz      timetz,
    col_money       money,
    -- number types
    col_int2        smallint        not null,
    col_int4        integer         not null,
    col_float4      real            not null,
    col_float8      double precision not null,
    -- bigint
    col_int8        bigint          not null,
    -- numeric
    col_numeric     numeric(10, 2),
    -- boolean
    col_bool        boolean         not null,
    -- date types
    col_date        date            not null,
    col_timestamp   timestamp       not null,
    col_timestamptz timestamptz     not null default now(),
    -- binary
    col_bytea       bytea,
    -- special types
    col_oid         oid,
    col_xid         xid,
    col_name        name,
    col_pg_lsn      pg_lsn,
    col_tsvector    tsvector,
    col_tsquery     tsquery,
    col_point       point,
    col_line        line,
    col_lseg        lseg,
    col_box         box,
    col_path        path,
    col_polygon     polygon,
    col_circle      circle,

    constraint type_coverage_pk primary key (col_uuid)
);

commit;
