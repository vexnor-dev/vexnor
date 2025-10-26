BEGIN TRANSACTION;

CREATE TABLE valnor_test.account
(
    account_id  uniqueidentifier NOT NULL DEFAULT NEWID(),
    parent_id   uniqueidentifier,
    status      varchar(20)      NOT NULL DEFAULT 'created',
    email       varchar(255)     NOT NULL,
    first_name  varchar(50)      NOT NULL,
    last_name   varchar(50)      NOT NULL,
    notes       varchar(max),
    created_at  datetimeoffset   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    modified_at datetimeoffset   NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT account_pk PRIMARY KEY (account_id),
    CONSTRAINT account_parent_fk FOREIGN KEY (parent_id) REFERENCES valnor_test.account (account_id),
    CONSTRAINT account_status_check CHECK (status IN ('created', 'confirmed', 'deleted'))
);

COMMIT;
