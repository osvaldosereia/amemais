-- CDSB: cadastros conectados e acompanhamento operacional sem alteração de estoque.
-- Campos opcionais preservam integralmente as pessoas, fornecedores e pedidos existentes.
ALTER TABLE public.staff_profiles
 ADD COLUMN IF NOT EXISTS phone text,
 ADD COLUMN IF NOT EXISTS job_title text,
 ADD COLUMN IF NOT EXISTS department text,
 ADD COLUMN IF NOT EXISTS internal_notes text;
ALTER TABLE public.suppliers
 ADD COLUMN IF NOT EXISTS legal_name text,
 ADD COLUMN IF NOT EXISTS contact_role text,
 ADD COLUMN IF NOT EXISTS whatsapp text,
 ADD COLUMN IF NOT EXISTS website text,
 ADD COLUMN IF NOT EXISTS address text,
 ADD COLUMN IF NOT EXISTS payment_terms text,
 ADD COLUMN IF NOT EXISTS delivery_days integer,
 ADD COLUMN IF NOT EXISTS minimum_order_amount numeric(12,2),
 ADD COLUMN IF NOT EXISTS preferred_channel text;
ALTER TABLE public.suppliers
 DROP CONSTRAINT IF EXISTS suppliers_delivery_days_valid;
ALTER TABLE public.suppliers
 ADD CONSTRAINT suppliers_delivery_days_valid CHECK (delivery_days IS NULL OR delivery_days BETWEEN 1 AND 365);
ALTER TABLE public.suppliers
 DROP CONSTRAINT IF EXISTS suppliers_minimum_order_valid;
ALTER TABLE public.suppliers
 ADD CONSTRAINT suppliers_minimum_order_valid CHECK (minimum_order_amount IS NULL OR minimum_order_amount>=0);
ALTER TABLE public.suppliers
 DROP CONSTRAINT IF EXISTS suppliers_preferred_channel_valid;
ALTER TABLE public.suppliers
 ADD CONSTRAINT suppliers_preferred_channel_valid CHECK(preferred_channel IS NULL OR preferred_channel IN ('whatsapp','telefone','email','outro'));

CREATE TABLE IF NOT EXISTS public.procurement_tasks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
 purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
 assigned_to uuid REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 160),
 description text,
 task_kind text NOT NULL DEFAULT 'manual' CHECK(task_kind IN('manual','delivery_followup','supplier_contact','replenishment')),
 status text NOT NULL DEFAULT 'pendente' CHECK(status IN('pendente','em_andamento','concluida','cancelada')),
 due_date date,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS procurement_tasks_delivery_once
 ON public.procurement_tasks(purchase_order_id) WHERE task_kind='delivery_followup';
CREATE INDEX IF NOT EXISTS procurement_tasks_due_status ON public.procurement_tasks(status,due_date);
CREATE INDEX IF NOT EXISTS procurement_tasks_assignee ON public.procurement_tasks(assigned_to,status);
CREATE INDEX IF NOT EXISTS procurement_tasks_supplier ON public.procurement_tasks(supplier_id,status);
ALTER TABLE public.procurement_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS procurement_tasks_read ON public.procurement_tasks;
CREATE POLICY procurement_tasks_read ON public.procurement_tasks FOR SELECT TO authenticated
 USING(app_private.has_permission('purchases.manage') OR
   (assigned_to=(SELECT auth.uid()) AND app_private.is_active()));
DROP POLICY IF EXISTS procurement_tasks_insert ON public.procurement_tasks;
CREATE POLICY procurement_tasks_insert ON public.procurement_tasks FOR INSERT TO authenticated
 WITH CHECK(app_private.has_permission('purchases.manage') AND
  (created_by=(SELECT auth.uid()) OR created_by IS NULL));
DROP POLICY IF EXISTS procurement_tasks_update ON public.procurement_tasks;
CREATE POLICY procurement_tasks_update ON public.procurement_tasks FOR UPDATE TO authenticated
 USING(app_private.has_permission('purchases.manage'))
 WITH CHECK(app_private.has_permission('purchases.manage'));
GRANT SELECT,INSERT,UPDATE ON public.procurement_tasks TO authenticated;
REVOKE ALL ON public.procurement_tasks FROM anon;

CREATE OR REPLACE FUNCTION public.set_procurement_task_status(p_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_task public.procurement_tasks%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT app_private.is_active() THEN
  RAISE EXCEPTION 'Usuário não autorizado'; END IF;
 IF p_status NOT IN ('pendente','em_andamento','concluida','cancelada') OR p_status IS NULL THEN
  RAISE EXCEPTION 'Situação inválida'; END IF;
 SELECT * INTO v_task FROM public.procurement_tasks WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;
 IF NOT (app_private.has_permission('purchases.manage') OR v_task.assigned_to=auth.uid()) THEN
  RAISE EXCEPTION 'Sem permissão para esta tarefa'; END IF;
 UPDATE public.procurement_tasks SET status=p_status,updated_at=now() WHERE id=p_id;
 INSERT INTO public.audit_log(entity,entity_id,action,actor_id,details)
 VALUES('procurement_tasks',p_id::text,'TASK_STATUS_CHANGED',auth.uid(),
 jsonb_build_object('before',v_task.status,'after',p_status));
END;$fn$;
REVOKE ALL ON FUNCTION public.set_procurement_task_status(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_procurement_task_status(uuid,text) TO authenticated;

-- A emissão de um pedido cria/atualiza uma tarefa de acompanhamento; não envia mensagens.
CREATE OR REPLACE FUNCTION public.enqueue_purchase_delivery_followup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE v_due date;
BEGIN
 IF NEW.status='enviado' THEN
  v_due:=COALESCE(NEW.expected_arrival_date,
    (COALESCE(NEW.sent_at,now())::date+COALESCE(NEW.estimated_days,15)));
  INSERT INTO public.procurement_tasks
   (supplier_id,purchase_order_id,assigned_to,title,description,task_kind,status,due_date,created_by)
  VALUES(NEW.supplier_id,NEW.id,NEW.created_by,
    'Acompanhar entrega PC-'||NEW.number::text,
    'Confirmar entrega e divergências do pedido de compra.', 'delivery_followup',
    'pendente',v_due,NEW.created_by)
  ON CONFLICT(purchase_order_id) WHERE task_kind='delivery_followup'
  DO UPDATE SET due_date=EXCLUDED.due_date,
    supplier_id=EXCLUDED.supplier_id,
    updated_at=now();
 ELSIF NEW.status IN ('finalizado','cancelado') THEN
  UPDATE public.procurement_tasks SET
   status=CASE WHEN NEW.status='finalizado' THEN 'concluida' ELSE 'cancelada' END,
   updated_at=now()
  WHERE purchase_order_id=NEW.id AND task_kind='delivery_followup'
    AND status NOT IN ('concluida','cancelada');
 END IF;
 RETURN NEW;
END;$fn$;
DROP TRIGGER IF EXISTS purchase_delivery_followup_trigger ON public.purchase_orders;
CREATE TRIGGER purchase_delivery_followup_trigger AFTER INSERT OR UPDATE OF
 status,expected_arrival_date,estimated_days ON public.purchase_orders
 FOR EACH ROW EXECUTE FUNCTION public.enqueue_purchase_delivery_followup();
REVOKE ALL ON FUNCTION public.enqueue_purchase_delivery_followup() FROM PUBLIC,anon,authenticated;

COMMENT ON TABLE public.procurement_tasks IS
 'Tarefas internas vinculadas a fornecedores, pedidos de compra e responsáveis; sem envio externo automático.';
