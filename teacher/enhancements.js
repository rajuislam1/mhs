/* MHS v14 Teacher Portal Enhancements - localStorage only */
(function(){
 const TGET=(k,f=[])=>{try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}};
 const TESC=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
 function searchTables(){document.querySelectorAll('.table-wrap').forEach(w=>{const t=w.querySelector('table.table');if(!t||w.querySelector('.record-search'))return;const i=document.createElement('input');i.className='record-search';i.type='search';i.placeholder='Search records…';i.style.cssText='width:100%;max-width:360px;margin:0 0 12px;padding:10px 12px;border:1px solid #d9dee5;border-radius:9px;font:inherit;box-sizing:border-box;background:#fff;';w.insertBefore(i,t);i.oninput=()=>{const q=i.value.toLowerCase().trim();[...t.querySelectorAll('tr')].slice(1).forEach(r=>r.style.display=!q||r.innerText.toLowerCase().includes(q)?'':'none')};});}
 const oldRender=window.render;
 window.render=function(){try{oldRender()}catch(e){console.error(e);if(window.view)window.view.innerHTML='<div class="panel"><div class="box"><h2>Teacher Dashboard</h2><p class="hint">The portal is loading. Please use the Dashboard button once.</p></div></div>';}setTimeout(searchTables,0)};
 window.dash=function(){
   const c=TGET('mhs_teacher_classes',[]).filter(x=>x.teacher===me.username),r=TGET('mhs_results',[]).filter(x=>mhsOwn(x,me.username)),rt=TGET('mhs_routines',[]).filter(x=>x.teacher===me.username);
   const subjects=[...new Set(c.map(x=>x.subject).filter(Boolean))];
   const classes=[...new Set(c.map(x=>'Class '+x.class+(x.section?' - '+x.section:'')))];
   view.innerHTML=`<div class="panel"><div class="cards4"><div class="stat"><b>${c.length}</b><span>Teaching Assignments</span></div><div class="stat"><b>${classes.length}</b><span>Classes</span></div><div class="stat"><b>${subjects.length}</b><span>Subjects</span></div><div class="stat"><b>${r.length}</b><span>My Result Records</span></div></div><div class="box"><h2>Welcome, ${TESC(me.name)}</h2><p>You can manage every class and subject assigned to you by the Super Admin.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${classes.map(x=>`<span class="pill-status">${TESC(x)}</span>`).join('')||'<span class="hint">No class assigned yet.</span>'}</div><h3 style="margin-top:20px">Assigned Subjects</h3><div style="display:flex;gap:8px;flex-wrap:wrap">${subjects.map(x=>`<span class="pill-status">${TESC(x)}</span>`).join('')||'<span class="hint">No subject assigned yet.</span>'}</div><p class="hint" style="margin-top:16px">Admin can add multiple classes and multiple subjects to your account. Your Publish Results page will automatically use those assignments.</p></div><div class="box"><h3>Quick Access</h3><div class="quick-grid"><button onclick="tab='classes';render()">My Classes</button><button onclick="tab='results';render()">Publish Results</button><button onclick="tab='classstudents';render()">Class Students</button><button onclick="tab='students';render()">Student Results</button></div></div></div>`;
 };
 window.classes=function(){
   const a=TGET('mhs_teacher_classes',[]).filter(x=>x.teacher===me.username);
   const grouped={};a.forEach(x=>{const k=String(x.class);(grouped[k]??=[]).push(x)});
   view.innerHTML=`<div class="panel"><div class="box"><h2>My Classes & Subjects</h2><p class="hint">This list is controlled by the Super Admin. Every class/subject assignment on your account appears here.</p>${Object.keys(grouped).sort().map(c=>`<div class="box" style="margin-top:12px"><div class="toolbar"><h3>Class ${TESC(c)}</h3><span>${grouped[c].length} assignment(s)</span></div><div style="display:flex;gap:8px;flex-wrap:wrap">${grouped[c].map(x=>`<span class="pill-status">${TESC(x.subject)}${x.section?' · Section '+TESC(x.section):''}</span>`).join('')}</div></div>`).join('')||'<div class="empty-admin">No classes have been assigned to this teacher yet.</div>'}</div></div>`;
 };
 setTimeout(searchTables,0);
})();
render();

