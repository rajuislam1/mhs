-- Add covering indexes for foreign keys reported by Supabase Performance Advisor.
-- Safe to run repeatedly; does not alter or delete school data.
create index if not exists idx_class_routines_subject_id
  on public.class_routines (subject_id);

create index if not exists idx_result_edit_requests_reviewed_by
  on public.result_edit_requests (reviewed_by);

create index if not exists idx_results_published_by
  on public.results (published_by);

create index if not exists idx_results_published_by_user_id
  on public.results (published_by_user_id);

create index if not exists idx_student_attendance_marked_by
  on public.student_attendance (marked_by);

create index if not exists idx_teacher_notifications_related_request_id
  on public.teacher_notifications (related_request_id);
