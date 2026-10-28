document.write(`<div class="topbar"><div>EIIN: 120140 · Estd. 1962 · Board of Intermediate and Secondary Education, Dinajpur</div><div><span>☎ 01752209431</span><span>✉ mokhleshpurhighschool@gmail.com</span></div></div><header class="header"><a class="brand" href="index.html"><img src="assets/images/logo.svg"><div><b>Mokhleshpur High School</b><span>মোখলেশপুর উচ্চ বিদ্যালয়</span></div></a><button class="menu" id="menu">☰</button><nav id="nav"><a href="index.html" data-i18n="Home">Home</a><a href="notices.html" data-i18n="Notices">Notices</a><a href="teachers.html" data-i18n="Teachers">Teachers</a><a href="gallery.html">Gallery</a><a href="results.html" data-i18n="Results">Results</a><a href="student/login.html" data-i18n="Student Portal">Student Portal</a><a href="admission.html" data-i18n="Admission">Admission</a><button class="lang-btn" id="langToggle" onclick="MHS_I18N.toggle()">বাংলা</button><a class="admin-btn" href="admin/login.html">▣ <span data-i18n="Admin">Admin</span></a></nav></header><div class="ticker"><strong>নোটিশ</strong><div id="tickerItems"></div></div>`);setTimeout(()=>document.getElementById('menu')?.addEventListener('click',()=>document.getElementById('nav').classList.toggle('open')),0);document.write('<script src="js/i18n.js"><\/script>');

document.addEventListener('DOMContentLoaded',async()=>{
 try{
  if(!window.mhsSupabaseReady){
   await new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(s=>s.src.endsWith('/js/supabase.js')||s.src.endsWith('js/supabase.js'));
    if(existing){if(existing.dataset.loaded==='1')return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
    const script=document.createElement('script');script.src='js/supabase.js';script.onload=resolve;script.onerror=()=>reject(new Error('Supabase loader failed'));document.head.appendChild(script);
   });
  }
  const sb=await window.mhsSupabaseReady;
  const [{data:settings,error:settingsError},{data:tickers,error:tickerError}]=await Promise.all([
   sb.from('school_settings').select('school_name,school_name_en,eiin,established_year,phone,email,logo_url').order('updated_at',{ascending:false}).limit(1),
   sb.from('notice_tickers').select('message,link_url').eq('is_active',true).order('display_order').limit(1)
  ]);
  if(settingsError)throw settingsError;if(tickerError)throw tickerError;
  const s=settings?.[0];
  if(s){
   const brand=document.querySelector('.brand');if(brand){const b=brand.querySelector('b'),sub=brand.querySelector('span'),img=brand.querySelector('img');if(b&&s.school_name_en)b.textContent=s.school_name_en;if(sub&&s.school_name)sub.textContent=s.school_name;if(img&&s.logo_url)img.src=s.logo_url;}
   const top=document.querySelector('.topbar > div:first-child');if(top)top.textContent='EIIN: '+(s.eiin||'')+' · Estd. '+(s.established_year||'')+' · Mokhleshpur High School';
   const contacts=document.querySelectorAll('.topbar > div:last-child span');if(contacts.length>=2){if(s.phone)contacts[0].textContent='☎ '+s.phone;if(s.email)contacts[1].textContent='✉ '+s.email;}
  }
  const ticker=tickers?.[0],target=document.getElementById('tickerItems');
  if(ticker&&target){target.replaceChildren();const span=document.createElement('span');if(ticker.link_url){const a=document.createElement('a');a.href=ticker.link_url;a.textContent=ticker.message;a.rel='noopener noreferrer';span.appendChild(a);}else span.textContent=ticker.message;target.appendChild(span);}
 }catch(error){console.error('Central public header settings could not be loaded:',error);}
});
