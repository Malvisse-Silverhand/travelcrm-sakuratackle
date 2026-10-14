-- Activity log: changes made by the server with the service role (accepting
-- an invitation, assigning a vendor's boats) were attributed to "Website",
-- which reads as if a customer did them. Name them "System" instead; only
-- anonymous requests (the public booking form) are "Website".

create or replace function private.log_activity(
  p_action text, p_entity text, p_entity_id text, p_summary text, p_details jsonb default '{}'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select full_name into v_name from profiles where id = auth.uid();
  insert into activity_log (actor_id, actor_name, action, entity, entity_id, summary, details)
  values (
    auth.uid(),
    coalesce(
      v_name,
      case
        when auth.uid() is not null then 'Unknown'
        when coalesce(auth.role(), '') = 'service_role' then 'System'
        else 'Website'
      end
    ),
    p_action, p_entity, p_entity_id, p_summary, coalesce(p_details, '{}')
  );
end;
$$;
