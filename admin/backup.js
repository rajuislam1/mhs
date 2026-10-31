/* Admin-only database export. Never exports passwords or service-role credentials. */
(function(){
 'use strict';
 const button=document.getElementById('backupData');if(!button)return;
 const tables=[
  ['school_settings','*'],['academic_years','*'],['classes','*'],['subjects','*'],['class_subjects','*'],
  ['students','*'],['student_enrollments','*'],['student_promotions','*'],['student_subjects','*'],
  ['teachers','id,teacher_id,name,designation,mobile,email,username,status,created_at,updated_at,subject,qualification,photo'],
  ['teacher_assignments','*'],['results','*'],['result_edit_requests','*'],['class_routines','*'],
  ['student_fees','*'],['student_attendance','*'],['student_documents','*'],['notices','*'],
  ['notice_tickers','*'],['gallery','*'],['achievements','*'],['admission_applications','*']
 ];
 button.addEventListener('click',async function(){
  const original=button.textContent;button.disabled=true;button.textContent='Preparing database backup…';
  try{
   const sb=await window.mhsSupabaseReady;const {data:auth,error:ae}=await sb.auth.getUser();if(ae||!auth.user)throw new Error('Please sign in as an administrator first.');
   const {data:profile,error:pe}=await sb.from('user_profiles').select('role,is_active').eq('id',auth.user.id).maybeSingle();if(pe||!profile||profile.role!=='super_admin'||profile.is_active!==true)throw new Error('Active Super Admin permission required.');
   const output={product:'Mokhleshpur High School',backupType:'supabase-database-export',createdAt:new Date().toISOString(),project:'wolxiieqyqeihvdefomd',tables:{}};
   for(const [table,columns] of tables){const {data,error}=await sb.from(table).select(columns);if(error){if(error.code==='42P01'||error.code==='PGRST205'){output.tables[table]={skipped:true,reason:'Table unavailable through the Data API'};continue;}throw new Error('Could not export '+table+': '+error.message);}output.tables[table]=data||[];}
   const blob=new Blob([JSON.stringify(output,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mhs-supabase-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   if(window.mhsToast)window.mhsToast('Supabase data export downloaded.');else alert('Supabase data export downloaded.');
  }catch(e){console.error('MHS database backup failed:',e);alert(e.message||'Database export failed.');}
  finally{button.disabled=false;button.textContent=original;}
 });
})();