-- MHS Supabase migration Step 1: READ-ONLY schema and access inspection
-- Run in Supabase SQL Editor. This script does not modify data or policies.

-- A. Exact columns and types used by the Students module
SELECT table_name, ordinal_position, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('students', 'classes', 'academic_years', 'student_enrollments', 'student_documents')
ORDER BY table_name, ordinal_position;

-- B. Class labels and IDs used to map existing localStorage student records
SELECT id, name, class_number, status FROM public.classes ORDER BY class_number, name;

-- C. Academic years available for student records
SELECT id, year, name, is_active FROM public.academic_years ORDER BY year DESC;

-- D. Current student table policies only
SELECT tablename, policyname, cmd, qual AS using_condition, with_check AS insert_update_condition
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'students'
ORDER BY policyname;

-- E. Current counts (for comparison before/after migration)
SELECT 'students' AS table_name, COUNT(*) AS row_count FROM public.students
UNION ALL SELECT 'classes', COUNT(*) FROM public.classes
UNION ALL SELECT 'academic_years', COUNT(*) FROM public.academic_years;
