const SITE_ACTIVE=JSON.parse(localStorage.getItem('mhs_site_settings')||'null')||SITE;
const noticeData=JSON.parse(localStorage.getItem('mhs_notices')||'null')||NOTICES; const tickerCfg=JSON.parse(localStorage.getItem('mhs_ticker_notice')||'null')||{text:noticeData[0]?.title||'School notice'};
const escSite=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const ti=document.getElementById('tickerItems'); if(ti)ti.innerHTML=`<span>${escSite(tickerCfg.text||'School notice')}</span>`;
const ab=document.getElementById('aboutText');if(ab)ab.textContent=SITE_ACTIVE.about;
const nc=document.getElementById('noticeCards');if(nc)nc.innerHTML=noticeData.slice(0,3).map(n=>`<article class="notice-card"><small>${new Date(n.date).toLocaleDateString('en-GB')}</small><h3>${escSite(n.title)}</h3><p>${escSite(n.description)}</p><a href="notices.html">Read notice →</a></article>`).join('');
const statVals=document.querySelectorAll('.stats strong');if(statVals.length>=4){let _s=[],_t=null;try{_s=JSON.parse(localStorage.getItem('mhs_students')||'[]')}catch{}try{_t=JSON.parse(localStorage.getItem('mhs_teachers')||'null')}catch{}statVals[0].textContent=_s.length;statVals[1].textContent=String((_t||TEACHERS).length).padStart(2,'0');statVals[2].textContent=SITE_ACTIVE.serviceYears;statVals[3].textContent=SITE_ACTIVE.passRate}
document.getElementById('menu')?.addEventListener('click',()=>document.getElementById('nav')?.classList.toggle('open'));

(function(){const bg=document.querySelector('.hero-bg');if(!bg)return;let h=null;try{h=JSON.parse(localStorage.getItem('mhs_hero')||'null')}catch{}const L=(h===null?['assets/images/hero/1.jpg','assets/images/hero/2.jpg']:h.map(x=>x.url)).filter(Boolean);if(!L.length)return;const imgs=L.map((u,i)=>{const m=document.createElement('img');m.src=u;m.alt='';m.className='hero-slide'+(i?'':' on');bg.before(m);return m});bg.remove();if(imgs.length>1){let i=0;setInterval(()=>{imgs[i].classList.remove('on');i=(i+1)%imgs.length;imgs[i].classList.add('on')},5000)}})();


/* Supabase public notices: home page notice cards */
(async function loadMhsPublicNoticeCards() {
  const container = document.getElementById('noticeCards');
  if (!container) return;
  try {
    if (!window.mhsSupabaseReady) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'js/supabase.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Could not load js/supabase.js'));
        document.head.appendChild(script);
      });
    }
    const sb = await window.mhsSupabaseReady;
    const { data, error } = await sb
      .from('notices')
      .select('id,title,content,attachment_url,published_at,created_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(3);
    if (error) throw error;
    const rows = data || [];
    container.innerHTML = rows.map(n => `<article class="notice-card"><small>${new Date(n.published_at || n.created_at).toLocaleDateString('en-GB')}</small><h3>${escSite(n.title)}</h3><p>${escSite(n.content || '')}</p><a href="notices.html">Read notice →</a></article>`).join('') || '<p class="hint">No notices published.</p>';
  } catch (error) {
    console.error('Public Supabase notices could not be loaded; keeping local fallback.', error);
  }
})();


/* Central public content from Supabase; no browser-local admin content is required. */
(async function loadMhsPublicSettingsAndHero(){
 try{
  const sb=window.mhsSupabaseReady?await window.mhsSupabaseReady:null;
  if(!sb)return;
  const [{data:settings,error:settingsError},{data:tickers,error:tickerError},{data:heroRows,error:heroError}] = await Promise.all([
   sb.from('school_settings').select('school_name,school_name_en,eiin,established_year,slogan,headmaster_name,student_count,teacher_count,service_years,ssc_pass_rate,address,about_text,logo_url,favicon_url').order('updated_at',{ascending:false}).limit(1),
   sb.from('notice_tickers').select('message,link_url').eq('is_active',true).order('display_order').limit(1),
   sb.from('gallery').select('image_url,title').eq('is_published',true).eq('category','hero').order('display_order').limit(10)
  ]);
  if(settingsError)throw settingsError;if(tickerError)throw tickerError;if(heroError)throw heroError;
  const s=settings?.[0];
  if(s){
   const title=document.querySelector('.hero h1');if(title&&s.school_name_en)title.textContent=s.school_name_en;
   const bn=document.querySelector('.hero h2');if(bn&&s.school_name)bn.textContent=s.school_name;
   const pill=document.querySelector('.hero-content .pill');if(pill)pill.textContent='Estd. '+(s.established_year||'')+(s.eiin?' · EIIN '+s.eiin:'');
   const about=document.getElementById('aboutText');if(about&&s.about_text)about.textContent=s.about_text;
   const stats=document.querySelectorAll('.stats strong');
   if(stats.length>=4){if(s.student_count!=null)stats[0].textContent=s.student_count;if(s.teacher_count!=null)stats[1].textContent=String(s.teacher_count).padStart(2,'0');if(s.service_years!=null)stats[2].textContent=s.service_years;if(s.ssc_pass_rate)stats[3].textContent=s.ssc_pass_rate;}
   const info=document.querySelectorAll('.info-card span');if(info.length>=2){if(s.headmaster_name)info[0].textContent=s.headmaster_name;if(s.address)info[1].textContent=s.address;}
   if(s.logo_url){document.querySelectorAll('.site-logo img,.brand img,header img.logo').forEach(img=>img.src=s.logo_url);}
   if(s.favicon_url){let icon=document.querySelector('link[rel="icon"]');if(icon)icon.href=s.favicon_url;}
  }
  const ticker=tickers?.[0],tickerItems=document.getElementById('tickerItems');
  if(ticker&&tickerItems){const span=document.createElement('span');span.textContent=ticker.message;if(ticker.link_url){const a=document.createElement('a');a.href=ticker.link_url;a.textContent=ticker.message;a.rel='noopener noreferrer';span.replaceChildren(a);}tickerItems.replaceChildren(span);}
  if(heroRows?.length){
   document.querySelectorAll('.hero-slide').forEach(img=>img.remove());
   const bg=document.querySelector('.hero-bg');
   if(bg){const slides=heroRows.map((row,i)=>{const img=document.createElement('img');img.src=row.image_url;img.alt=row.title||'School hero image';img.className='hero-slide'+(i===0?' on':'');bg.before(img);return img;});bg.remove();if(slides.length>1){let i=0;setInterval(()=>{slides[i].classList.remove('on');i=(i+1)%slides.length;slides[i].classList.add('on');},5000);}}
  }
 }catch(error){console.error('Could not load public school settings from Supabase:',error);}
})();
