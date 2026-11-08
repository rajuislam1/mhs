/* MHS Admin shell with role-based module visibility. Server and RLS enforce permissions too. */
if(sessionStorage.getItem('mhs_admin')!=='1') location.replace('/admin/login');
const app=document.getElementById('app'),title=document.getElementById('title');
let tab='overview';
const role=sessionStorage.getItem('mhs_admin_role')||'super_admin';
let permissions={};
try{permissions=JSON.parse(sessionStorage.getItem('mhs_admin_permissions')||'{}')||{};}catch{permissions={};}
const labels={attendance:'Attendance Progress',routine:'Class Routine',examroutine:'Exam Routine Management',overview:'Dashboard',academicYears:'Academic Year Management',notices:'Notice Management',teachers:'Teachers & Accounts',results:'Student Results',editrequests:'Result Edit Requests',admitcards:'Admit Card Print',gallery:'Achievements & Gallery',settings:'School Settings',schoolStatistics:'School Statistics',schoolContent:'Website Sections & Content',students:'Student Database',subjects:'Academic Subjects',studentSubjects:'Student Subject Selection',promotion:'Class Promotion',admissions:'Admission Applications',fees:'Fees Management',feePayments:'Record Fee Payment',hero:'Hero Images',rolemanagement:'Role Management'};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function canAccess(key){
 if(role==='super_admin')return true;
 if(key==='overview')return true;
 if(key==='rolemanagement'||['settings','schoolStatistics','schoolContent','hero'].includes(key))return false;
 return permissions[key]===true;
}
function applyNavigationAccess(){
 document.querySelectorAll('nav button[data-tab]').forEach(button=>{
  const allowed=canAccess(button.dataset.tab);
  button.hidden=!allowed;
  button.setAttribute('aria-hidden',String(!allowed));
 });
 const caption=document.querySelector('.side-caption');
 if(caption)caption.textContent=role==='super_admin'?'SUPER ADMIN':role.toUpperCase()+' PORTAL';
}
function render(){
 const mainPane=document.querySelector('.admin-shell main');if(mainPane)mainPane.scrollTop=0;
 if(!canAccess(tab)){tab='overview';}
 window.mhsAdminActiveTab=tab;title.textContent=labels[tab]||'Dashboard';
 document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 const routes={academicYears:window.MHS_EXTRA?.academicYears,attendance:window.MHS_EXTRA?.attendance,routine:window.MHS_EXTRA?.routine,examroutine:window.MHS_EXTRA?.examroutine,overview:window.overview,notices:window.notices,teachers:window.teachers,results:window.results,editrequests:window.MHS_EXTRA?.editrequests,admitcards:window.MHS_EXTRA?.admitcards,gallery:window.gallery,settings:window.settings,schoolStatistics:window.schoolStatistics,schoolContent:window.MHS_EXTRA?.schoolContent,students:window.MHS_EXTRA?.students,subjects:window.MHS_EXTRA?.subjects,studentSubjects:window.MHS_EXTRA?.studentSubjects,promotion:window.MHS_EXTRA?.promotion,admissions:window.MHS_EXTRA?.admissions,fees:window.MHS_EXTRA?.fees,feePayments:window.MHS_EXTRA?.feePayments,hero:window.MHS_EXTRA?.hero,rolemanagement:window.MHS_ROLE_MANAGEMENT?.render};
 const fn=routes[tab];
 if(typeof fn!=='function'){app.innerHTML='<div class="panel"><div class="box"><h2>Module unavailable</h2><p>Supabase module is not loaded for '+esc(tab)+'.</p></div></div>';return;}
 Promise.resolve(fn()).catch(e=>{console.error(e);app.innerHTML='<div class="panel"><div class="box"><h2>Could not load data</h2><p>'+esc(e.message||'Supabase request failed.')+'</p></div></div>';});
}
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>{if(!canAccess(b.dataset.tab))return;tab=b.dataset.tab;render();}));
document.getElementById('logout').addEventListener('click',async()=>{try{const sb=await window.mhsSupabaseReady;await sb.auth.signOut()}catch(e){console.error(e)}finally{['mhs_admin','mhs_admin_role','mhs_admin_permissions','mhs_admin_name'].forEach(k=>sessionStorage.removeItem(k));location.href='/admin/login'}});
document.getElementById('adminLang').addEventListener('click',()=>{document.documentElement.classList.toggle('bn-admin');document.getElementById('adminLang').textContent=document.documentElement.classList.contains('bn-admin')?'English':'বাংলা'});
applyNavigationAccess();
const backupButton=document.getElementById('backupData');if(backupButton&&role!=='super_admin')backupButton.hidden=true;
window.render=render;window.mhsAdminRefresh=render;window.mhsAdminCanAccess=canAccess;window.mhsAdminRole=role;
