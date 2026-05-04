begin;

create view valnor_test.account_order_summary as
select
    a.account_id,
    a.email,
    a.first_name,
    a.last_name,
    a.status,
    count(o.order_id)        as order_count,
    max(o.created_at)        as latest_order_at
from valnor_test.account a
left join valnor_test.order o on o.account_id = a.account_id
group by a.account_id, a.email, a.first_name, a.last_name, a.status;

commit;
