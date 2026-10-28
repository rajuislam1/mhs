-- MHS Supabase migration audit: READ-ONLY inspection
-- This script does not create, update, or delete data, tables, or policies.
-- Run before the full schema migration to understand what already exists.

-- 1. Relevant public tables and their exact columns/types.
SELECT
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns AS c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'user_profiles',
    'teachers',
    'teacher_public_profiles',
    'students',
    'student_enrollments',
    'student_documents',
    'classes',
    'subjects',
    'academic_years',
    'class_subjects',
    'teacher_assignments',
    'results',
    'result_edit_requests',
    'notices',
    'admission_applications',
    'fees',
    'class_routines',
    'school_settings',
    'gallery_items',
    'achievements'
  )
ORDER BY c.table_name, c.ordinal_position;

-- 2. Existing RLS status for relevant tables.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname IN (
    'user_profiles',
    'teachers',
    'teacher_public_profiles',
    'students',
    'student_enrollments',
    'student_documents',
    'classes',
    'subjects',
    'academic_years',
    'class_subjects',
    'teacher_assignments',
    'results',
    'result_edit_requests',
    'notices',
    'admission_applications',
    'fees',
    'class_routines',
    'school_settings',
    'gallery_items',
    'achievements'
  )
ORDER BY c.relname;

-- 3. Existing policies for those tables.
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_condition,
  with_check AS insert_update_condition
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'user_profiles',
    'teachers',
    'teacher_public_profiles',
    'students',
    'student_enrollments',
    'student_documents',
    'classes',
    'subjects',
    'academic_years',
    'class_subjects',
    'teacher_assignments',
    'results',
    'result_edit_requests',
    'notices',
    'admission_applications',
    'fees',
    'class_routines',
    'school_settings',
    'gallery_items',
    'achievements'
  )
ORDER BY tablename, policyname;

-- 4. Existing public tables that may be relevant but were not listed above.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 5. Storage buckets (metadata only).
SELECT id, name, public, created_at, updated_at
FROM storage.buckets
ORDER BY name;
