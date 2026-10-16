-- Avaria imediata, respeitando estoque livre e auditoria pelo stock_operation_batch.
CREATE OR REPLACE FUNCTION public.record_stock_exception(p_product_id uuid, p_quantity integer, p_expected integer, p_reason text, p_details text, p_recipient text, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid:=auth.uid();v_destination uuid;v_note text;
 v_recipient text:=nullif(btrim(coalesce(p_recipient,'')),'');
 v_details text:=btrim(coalesce(p_details,''));
 v_batch uuid;v_result jsonb;v_saved_reason text;
begin
 if v_actor is null or not app_private.role_in('admin','gerente') or not app_private.has_permission('stock.exit')
 then raise exception 'Sem permissão para baixa excepcional';end if;
 if p_product_id is null or p_quantity is null or p_quantity not between 1 and 1000000
 or p_expected is null or p_expected not between 0 and 1000000
 then raise exception 'Produto, quantidade ou saldo esperado inválidos';end if;
 -- Avaria agora sai diretamente do estoque. A entrada após reparo será manual.
 if p_reason not in ('avaria','extravio','diretoria','doacao','outro')
 then raise exception 'Motivo de saída inválido';end if;
 if length(v_details) not between 5 and 250
 then raise exception 'Informe justificativa entre 5 e 250 caracteres';end if;
 if p_reason in ('diretoria','doacao') and length(coalesce(v_recipient,'')) not between 2 and 120
 then raise exception 'Identifique o destinatário';end if;
 if v_recipient is not null and length(v_recipient)>120
 then raise exception 'Destinatário muito longo';end if;
 if p_request_id is null then raise exception 'Identificador obrigatório';end if;
 select id into v_destination from public.stock_destinations where system_reason=p_reason and active;
 if v_destination is null then raise exception 'Destino de baixa excepcional indisponível';end if;
 v_note:='Baixa excepcional ('||p_reason||')'||
  (case when v_recipient is not null then ' | Recebedor: '||v_recipient else '' end)||
  ' | '||v_details;
 if length(v_note)>400 then raise exception 'Justificativa excede limite';end if;
 v_result:=public.stock_operation_batch('saida',
  jsonb_build_array(jsonb_build_object(
   'product_id',p_product_id,'quantity',p_quantity,'expected',p_expected)),
  v_destination,v_note,p_request_id);
 v_batch:=(v_result->>'batch_id')::uuid;
 select exception_reason into v_saved_reason from public.stock_operation_batches where id=v_batch for update;
 if v_saved_reason is not null and v_saved_reason<>p_reason
 then raise exception 'Motivo inconsistente na repetição da operação';end if;
 update public.stock_operation_batches
 set exception_reason=p_reason,exception_recipient=v_recipient
 where id=v_batch and exception_reason is null;
 return v_result;
end;$function$

revoke all on function public.record_stock_exception(uuid,integer,integer,text,text,text,uuid) from public,anon;
grant execute on function public.record_stock_exception(uuid,integer,integer,text,text,text,uuid) to authenticated;
