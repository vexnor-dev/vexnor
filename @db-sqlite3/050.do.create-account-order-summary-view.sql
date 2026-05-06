CREATE VIEW account_order_summary AS
SELECT
    a.account_id,
    a.email,
    a.first_name,
    a.last_name,
    a.status,
    COUNT(o.order_id)    AS order_count,
    MAX(o.created_at)    AS latest_order_at
FROM account a
LEFT JOIN "order" o ON o.account_id = a.account_id
GROUP BY a.account_id, a.email, a.first_name, a.last_name, a.status;
