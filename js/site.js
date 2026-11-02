/* MHS public website — fast local-first rendering with optional Supabase updates */
(function () {
  'use strict';
  const E = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  })[ch]);
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null && String(value).trim() !== '') el.textContent = value;
  };
  const fallback = typeof SITE !== 'undefined' ? SITE : {};

  // Render meaningful school content immediately; the public site must not wait for the database.
  setText('aboutText', fallback.about || 'Mokhleshpur High School has been serving the community since 1962.');
  const hero = document.querySelector('.hero');
  const heroBg = hero?.querySelector('.hero-bg');
  if (heroBg) {
    heroBg.src = 'assets/images/hero/1.jpg';
    heroBg.onerror = () => { heroBg.onerror = null; heroBg.src = 'assets/images/hero-placeholder.svg'; };
  }

  const ticker = document.getElementById('tickerItems');
  if (ticker && !ticker.textContent.trim()) {
    const span = document.createElement('span');
    span.textContent = (typeof NOTICES !== 'undefined' && NOTICES[0]?.title) || 'Welcome to Mokhleshpur High School';
    ticker.appendChild(span);
  }

  // A slow/offline Supabase request must never block the page or suppress local fallback content.
  const withTimeout = (promise, ms = 9000) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Public content request timed out')), ms))
  ]);
  const query = async (builder, label) => {
    try {
      const result = await withTimeout(builder);
      if (result.error) throw result.error;
      return result;
    } catch (error) {
      console.warn('MHS public content:', label, error?.message || error);
      return { data: null, error };
    }
  };


  function renderSchoolStatistics(data) {
    if (!data || !data.is_published) return;
    const infra=document.getElementById('school-infrastructure'), people=document.getElementById('school-history-stats');
    if(infra){infra.hidden=false;const cards=[['Total Land',data.land_decimals==null?'—':data.land_decimals+' decimal'],['Playground',data.playground_decimals==null?'—':data.playground_decimals+' decimal'],['Building Space',data.floor_space_sqft==null?'—':Number(data.floor_space_sqft).toLocaleString()+' sq. ft.'],['Classrooms',data.room_count==null?'—':String(data.room_count)]];document.getElementById('mhsInfrastructureCards').innerHTML=cards.map(([l,v])=>'<article class="mhs-infra-card"><strong>'+E(v)+'</strong><span>'+E(l)+'</span></article>').join('');}
    if(people){people.hidden=false;const years=Array.isArray(data.annual_people)?data.annual_people:[];document.getElementById('mhsPeopleStats').innerHTML='<div class="table-wrap"><table class="mhs-data-table"><thead><tr><th>Year</th><th>Students</th><th>Teachers</th><th>Employees</th><th>Student-Teacher Ratio</th></tr></thead><tbody>'+years.slice().sort((a,b)=>Number(b.year)-Number(a.year)).map(x=>'<tr><td>'+E(x.year)+'</td><td>'+E(x.students??'—')+'</td><td>'+E(x.teachers??'—')+'</td><td>'+E(x.employees??'—')+'</td><td>'+E(x.ratio??'—')+'</td></tr>').join('')+'</tbody></table></div>';
      const table=list=>'<div class="table-wrap"><table class="mhs-data-table"><thead><tr><th>Year</th><th>Appeared</th><th>Passed</th><th>Failed</th><th>GPA-5</th><th>Pass Rate</th></tr></thead><tbody>'+((Array.isArray(list)?list:[]).slice().sort((a,b)=>Number(b.year)-Number(a.year)).map(x=>'<tr><td>'+E(x.year)+'</td><td>'+E(x.appeared??'—')+'</td><td>'+E(x.passed??'—')+'</td><td>'+E(x.failed??'—')+'</td><td>'+E(x.gpa5??'—')+'</td><td><b>'+E(x.pass_rate??'—')+'</b></td></tr>').join(''))+'</tbody></table></div>';
      document.getElementById('mhsSscResults').innerHTML=table(data.ssc_results);document.getElementById('mhsJscResults').innerHTML=table(data.jsc_results);document.getElementById('mhsStatsSource').textContent=data.source_note||'Historical data; contact the school to verify.';}
  }


  function renderSchoolContent(rows) {
    const g={facility:[],event:[],achievement:[],calendar:[],library:[]};(rows||[]).forEach(x=>{if(g[x.content_type])g[x.content_type].push(x);});
    const card=x=>'<article class="mhs-content-card">'+(x.image_url?'<img loading="lazy" src="'+E(x.image_url)+'" alt="'+E(x.title)+'">':'')+'<div><h3>'+E(x.title)+'</h3>'+(x.title_bn?'<h4>'+E(x.title_bn)+'</h4>':'')+'<p>'+E(x.description||'')+'</p>'+(x.event_date?'<small>'+E(new Date(x.event_date+'T00:00:00').toLocaleDateString())+'</small>':'')+(x.location?'<small> · '+E(x.location)+'</small>':'')+'</div></article>';
    const fill=(sid,cid,list,n)=>{const s=document.getElementById(sid),el=document.getElementById(cid);if(!s||!el)return;const featured=list.filter(x=>x.is_featured),data=(featured.length?featured:list).slice(0,n);if(data.length){s.hidden=false;el.innerHTML=data.map(card).join('');}};
    fill('mhs-home-facilities','mhsHomeFacilities',g.facility,4);fill('mhs-home-events','mhsHomeEvents',g.event,3);fill('mhs-home-achievements','mhsHomeAchievements',g.achievement,3);fill('mhs-home-library','mhsHomeLibrary',g.library,3);
    const c=g.calendar.filter(x=>x.event_date).sort((a,b)=>a.event_date.localeCompare(b.event_date)),s=document.getElementById('mhs-home-calendar'),el=document.getElementById('mhsHomeCalendar');if(s&&el&&c.length){s.hidden=false;el.innerHTML=c.slice(0,5).map(x=>'<article class="mhs-calendar-item"><time>'+E(new Date(x.event_date+'T00:00:00').toLocaleDateString())+'</time><div><b>'+E(x.title)+'</b><p>'+E(x.description||'')+'</p></div></article>').join('');}
  }
  async function loadPublicSite() {
    let sb;
    try { sb = await withTimeout(window.mhsSupabaseReady, 9000); }
    catch (error) { console.warn('MHS database unavailable; showing saved school content.', error?.message || error); return; }

    const [settingsQ, noticesQ, tickerQ, galleryQ, heroQ, achievementsQ, teachersQ, statsQ, schoolStatsQ, schoolContentQ] = await Promise.all([
      query(sb.from('school_settings').select('school_name,school_name_en,established_year,slogan,logo_url,phone,email,address,about_text,mission_text,vision_text,history_text,student_count,teacher_count,service_years,ssc_pass_rate').limit(1).maybeSingle(), 'school settings'),
      query(sb.from('notices').select('id,title,content,attachment_url,published_at,created_at').eq('is_published',true).order('published_at',{ascending:false}).limit(3), 'notices'),
      query(sb.from('notice_tickers').select('message,link_url').eq('is_active',true).order('display_order').limit(1).maybeSingle(), 'notice ticker'),
      query(sb.from('gallery').select('title,description,image_url,category').eq('is_published',true).order('display_order').limit(6), 'gallery'),
      query(sb.from('hero_images').select('image_url,title,alt_text,display_order').eq('is_active',true).order('display_order'), 'hero images'),
      query(sb.from('achievements').select('id',{count:'exact',head:true}).eq('is_published',true), 'achievements'),
      query(sb.from('teacher_public_profiles').select('id',{count:'exact',head:true}).eq('is_published',true), 'teacher profiles'),
      query(sb.from('school_public_statistics').select('*').eq('id',1).maybeSingle(), 'public statistics'),
      query(sb.from('school_public_content').select('*').eq('is_published',true).order('display_order').order('event_date'), 'school content sections')
    ]);

    const s = settingsQ.data || {};
    setText('aboutText', s.about_text || fallback.about);

    const noticeList = noticesQ.data || [];
    const tickerMessage = tickerQ.data?.message || noticeList[0]?.title;
    if (ticker && tickerMessage) ticker.innerHTML = '<span>' + E(tickerMessage) + '</span>';

    const noticeCards = document.getElementById('noticeCards');
    if (noticeCards) noticeCards.innerHTML = noticeList.map(n =>
      '<article class="notice-card"><small>' + E(n.published_at || n.created_at ? new Date(n.published_at || n.created_at).toLocaleDateString('en-GB') : '') +
      '</small><h3>' + E(n.title) + '</h3><p class="notice-preview">' + E(n.content || '') +
      '</p><button type="button" class="notice-read-more" aria-expanded="false">Read more</button><a class="notice-full-link" href="notices.html">All notices →</a></article>'
    ).join('') || '<p class="hint">No notices published.</p>';
    noticeCards?.querySelectorAll('.notice-read-more').forEach(btn=>btn.addEventListener('click',()=>{const card=btn.closest('.notice-card');const expanded=card.classList.toggle('expanded');btn.setAttribute('aria-expanded',String(expanded));btn.textContent=expanded?'Show less':'Read more';}));

    const homeStats=document.getElementById('homeSchoolStats');if(homeStats&&settingsQ.data){const st=settingsQ.data;const vals=[[st.student_count??'—','Registered Students'],[st.teacher_count??'—','Teachers'],[st.service_years??'—','Years of Service'],[st.ssc_pass_rate==null?'—':String(st.ssc_pass_rate).includes('%')?st.ssc_pass_rate:st.ssc_pass_rate+'%','SSC Pass Rate']];homeStats.innerHTML=vals.map(([v,l])=>'<div><strong>'+E(v)+'</strong><span>'+E(l)+'</span></div>').join('');}

    const homeGallery = document.getElementById('homeGallery');
    if (homeGallery) { const localImages=['Entertainment.jpeg','Nobin boron.jpeg','Nobinboron.jpeg','head teacher.jpeg','kabadi.jpeg','hero/1.jpg','hero/2.jpg'].map((f,i)=>({title:['Entertainment','Nobin Boron','Nobin Boron','Head Teacher','Kabaddi','School Event','School Event'][i],image_url:'assets/images/'+f})); const remote=galleryQ.data||[]; const all=[...localImages,...remote].slice(0,16); homeGallery.innerHTML = all.map(x =>
      '<div><img loading="lazy" src="' + E(x.image_url) + '" alt="' + E(x.title || 'School gallery') +
      '"><small>' + E(x.title || x.description || '') + '</small></div>'
    ).join('') || '<p class="hint">Gallery photos will be published by the administration.</p>'; }

    renderSchoolStatistics(schoolStatsQ.data);
    renderSchoolContent(schoolContentQ.data||[]);

    const slides = (heroQ.data || []).map(x => x.image_url).filter(Boolean);
    if (heroBg && slides.length) {
      let i = 0;
      const show = () => { heroBg.onerror = () => { heroBg.onerror = null; heroBg.src = 'assets/images/hero-placeholder.svg'; }; heroBg.src = slides[i]; };
      show();
      if (slides.length > 1) window.setInterval(() => { i = (i + 1) % slides.length; show(); }, 6000);
    }
  }

  loadPublicSite().catch(error => console.warn('MHS public site fallback active:', error?.message || error));
})();
