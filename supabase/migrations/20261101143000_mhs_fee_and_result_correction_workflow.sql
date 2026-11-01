-- MHS Fee & Result Correction workflow migration
-- Applied to production Supabase project wolxiieqyqeihvdefomd on 2026-11-01.
-- Idempotent policy/function/trigger definitions for repository history.

create or replace function public.mhs_record_fee_payment(
 p_student_fee_id uuid,p_amount numeric,p_payment_method text default 'Cash',
 p_transaction_id text default null,p_payment_date date default current_date,
 p_remarks text default null
) returns uuid
language plpgsql security invoker set search_path=''
as $function$
declare v_fee public.student_fees%rowtype; v_payment_id uuid; v_total numeric(12,2);
begin
 if not exists(select 1 from public.user_profiles p where p.id=(select auth.uid()) and p.role='super_admin' and p.is_active=true) then
   raise exception 'Active Super Admin permission required';
 end if;
 if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;
 select * into v_fee from public.student_fees where id=p_student_fee_id for update;
 if not found then raise exception 'Fee record not found'; end if;
 v_total:=coalesce(v_fee.paid_amount,0)+p_amount;
 if v_total>v_fee.amount then raise exception 'Payment exceeds outstanding amount'; end if;
 insert into public.fee_payments(student_fee_id,student_id,amount,payment_method,transaction_id,payment_date,remarks,received_by)
 values(v_fee.id,v_fee.student_id,p_amount,coalesce(nullif(trim(p_payment_method),''),'Cash'),nullif(trim(p_transaction_id),''),coalesce(p_payment_date,current_date),nullif(trim(p_remarks),''),(select auth.uid()))
 returning id into v_payment_id;
 update public.student_fees set paid_amount=v_total,
 payment_status=case when v_total>=amount then 'paid' when v_total>0 then 'partial' else 'unpaid' end,
 paid_at=case when v_total>=amount then now() else paid_at end,
 payment_method=coalesce(nullif(trim(p_payment_method),''),'Cash'),
 transaction_id=nullif(trim(p_transaction_id),''),remarks=coalesce(nullif(trim(p_remarks),''),remarks),updated_at=now()
 where id=v_fee.id;
 return v_payment_id;
end $function$;
revoke all on function public.mhs_record_fee_payment(uuid,numeric,text,text,date,text) from public,anon;
grant execute on function public.mhs_record_fee_payment(uuid,numeric,text,text,date,text) to authenticated;

drop policy if exists "Super admins can review pending result edit requests" on public.result_edit_requests;
drop policy if exists "Super admins can review result edit requests" on public.result_edit_requests;
create policy "Super admins can review result edit requests" on public.result_edit_requests
for update to authenticated
using(status in ('pending','correction_submitted') and exists(select 1 from public.user_profiles p where p.id=(select auth.uid()) and p.role='super_admin' and p.is_active=true))
with check(status in ('approved','rejected','verified') and exists(select 1 from public.user_profiles p where p.id=(select auth.uid()) and p.role='super_admin' and p.is_active=true));

drop policy if exists "Teachers can submit result edit requests" on public.result_edit_requests;
create policy "Teachers can submit result edit requests" on public.result_edit_requests
for insert to authenticated with check(
 status='pending' and requested_marks is not null and requested_marks between 0 and 100
 and exists(select 1 from public.user_profiles p
 join public.teacher_assignments a on a.teacher_id=p.teacher_id
 join public.class_subjects cs on cs.class_id=a.class_id and cs.subject_id=a.subject_id and cs.academic_year_id=a.academic_year_id
 join public.results r on r.class_subject_id=cs.id and r.academic_year_id=cs.academic_year_id
 where p.id=(select auth.uid()) and p.role='teacher' and p.is_active=true and a.status=true
 and r.id=result_edit_requests.result_id and r.status='published'
 and r.marks is not distinct from result_edit_requests.old_marks
 and result_edit_requests.teacher_id=p.teacher_id and result_edit_requests.requested_by=(select auth.uid())::text)
);

drop policy if exists "Teachers can submit approved result corrections" on public.result_edit_requests;
create policy "Teachers can submit approved result corrections" on public.result_edit_requests
for update to authenticated
using(status='approved' and exists(select 1 from public.user_profiles p where p.id=(select auth.uid()) and p.role='teacher' and p.is_active=true and p.teacher_id=result_edit_requests.teacher_id and result_edit_requests.requested_by=(select auth.uid())::text))
with check(status='correction_submitted' and requested_marks is not null and requested_marks between 0 and 100 and correction_submitted_at is not null
 and exists(select 1 from public.user_profiles p where p.id=(select auth.uid()) and p.role='teacher' and p.is_active=true and p.teacher_id=result_edit_requests.teacher_id and result_edit_requests.requested_by=(select auth.uid())::text));

create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create or replace function private.mhs_audit_result_edit_request()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_action text; v_actor_teacher uuid; v_old numeric; v_new numeric; v_note text;
begin
 if TG_OP='INSERT' then v_action:='request';v_old:=NEW.old_marks;v_new:=NEW.requested_marks;v_note:=NEW.reason;
 else
  if NEW.status is not distinct from OLD.status then return NEW; end if;
  v_action:=case NEW.status when 'approved' then 'approve' when 'rejected' then 'reject' when 'correction_submitted' then 'teacher_update' when 'verified' then 'republish' else null end;
  if v_action is null then return NEW; end if;
  v_old:=coalesce(NEW.old_marks,OLD.old_marks);v_new:=coalesce(NEW.requested_marks,OLD.requested_marks);v_note:=coalesce(NEW.response_note,NEW.reason,OLD.reason);
 end if;
 select p.teacher_id into v_actor_teacher from public.user_profiles p where p.id=(select auth.uid()) and p.role='teacher' and p.is_active=true limit 1;
 insert into public.result_edit_audit(result_id,request_id,old_marks,new_marks,action,actor_user_id,actor_teacher_id,note)
 values(NEW.result_id,NEW.id,v_old,v_new,v_action,(select auth.uid()),v_actor_teacher,v_note);
 return NEW;
end $function$;
revoke all on function private.mhs_audit_result_edit_request() from public,anon,authenticated;
drop trigger if exists mhs_audit_result_edit_request on public.result_edit_requests;
create trigger mhs_audit_result_edit_request after insert or update of status on public.result_edit_requests
for each row execute function private.mhs_audit_result_edit_request();
