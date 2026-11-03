-- Complete module-to-table permission aliases for separate Admin UI modules.
create policy mhs_rbac_fee_payments_feePayments on public.fee_payments
  for all to authenticated
  using (public.mhs_has_admin_permission('feePayments'))
  with check (public.mhs_has_admin_permission('feePayments'));

create policy mhs_rbac_student_fees_feePayments on public.student_fees
  for all to authenticated
  using (public.mhs_has_admin_permission('feePayments'))
  with check (public.mhs_has_admin_permission('feePayments'));

create policy mhs_rbac_student_subjects_studentSubjects on public.student_subjects
  for all to authenticated
  using (public.mhs_has_admin_permission('studentSubjects'))
  with check (public.mhs_has_admin_permission('studentSubjects'));

create policy mhs_rbac_student_promotions_promotion on public.student_promotions
  for all to authenticated
  using (public.mhs_has_admin_permission('promotion'))
  with check (public.mhs_has_admin_permission('promotion'));

create policy mhs_rbac_subjects_subjects on public.subjects
  for all to authenticated
  using (public.mhs_has_admin_permission('subjects'))
  with check (public.mhs_has_admin_permission('subjects'));

create policy mhs_rbac_class_subjects_subjects on public.class_subjects
  for all to authenticated
  using (public.mhs_has_admin_permission('subjects'))
  with check (public.mhs_has_admin_permission('subjects'));

create policy mhs_rbac_result_edit_requests_editrequests on public.result_edit_requests
  for all to authenticated
  using (public.mhs_has_admin_permission('editrequests'))
  with check (public.mhs_has_admin_permission('editrequests'));

create policy mhs_rbac_result_edit_audit_editrequests on public.result_edit_audit
  for select to authenticated
  using (public.mhs_has_admin_permission('editrequests'));

create policy mhs_rbac_academic_years_admitcards on public.academic_years
  for all to authenticated
  using (public.mhs_has_admin_permission('admitcards'))
  with check (public.mhs_has_admin_permission('admitcards'));
