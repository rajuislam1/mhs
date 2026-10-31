/* MHS public website — Supabase-backed dynamic content */
(function () {
  'use strict';
  const E = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  })[ch]);
  const setText = (id, value) => { const el=document.getElementById(id); if(el && value!=null) el.textContent=value; };
  const fallback = typeof SITE !== 'undefined' ? SITE : {};
  document.getElementById('menu')?.addEventListener('click', () => document.getElementById('nav')?.classList.toggle('open'));

  async function loadPublicSite() {
    const sb = await window.mhsSupabaseReady;
    const [settingsQ, noticesQ, tickerQ, galleryQ, heroQ, achievementsQ, teachersQ] = await Promise.all([
      sb.from('school_settings').select('school_name,school_name_en,established_year,slogan,logo_url,phone,email,address,about_text,mission_text,vision_text,history_text,student_count,teacher_count,service_years,ssc_pass_rate').limit(1).maybeSingle(),
      sb.from('notices').select('id,title,content,attachment_url,published_at,created_at').eq('is_published',true).order('published_at',{ascending:false}).limit(3),
      sb.from('notice_tickers').select('message,link_url').eq('is_active',true).order('display_order').limit(1).maybeSingle(),
      sb.from('gallery').select('title,description,image_url,category').eq('is_published',true).order('display_order').limit(6),\n      sb.from('hero_images').select('image_url,title,alt_text,display_order').eq('is_active',true).order('display_order'),
      sb.from('achievements').select('id',{count:'exact',head:true}).eq('is_published',true),
      sb.from('teacher_public_profiles').select('id',{count:'exact',head:true}).eq('is_published',true)
    ]);
    if(settingsQ.error) throw settingsQ.error;
    if(noticesQ.error) throw noticesQ.error;
    if(tickerQ.error) throw tickerQ.error;
    if(galleryQ.error) throw galleryQ.error;\n    if(heroQ.error) throw heroQ.error;
    if(achievementsQ.error) throw achievementsQ.error;
    if(teachersQ.error) throw teachersQ.error;
    const s=settingsQ.data||{};
    const about=document.getElementById('aboutText'); if(about) about.textContent=s.about_text||fallback.about||'';
    const ticker=document.getElementById('tickerItems');
    if(ticker) ticker.innerHTML=(tickerQ.data?.message||noticesQ.data?.[0]?.title||'School notice') ? '<span>'+E(tickerQ.data?.message||noticesQ.data?.[0]?.title||'School notice')+'</span>' : '';
    const noticeCards=document.getElementById('noticeCards');
    if(noticeCards) noticeCards.innerHTML=(noticesQ.data||[]).map(n=>'<article class="notice-card"><small>'+E(new Date(n.published_at||n.created_at).toLocaleDateString('en-GB'))+'</small><h3>'+E(n.title)+'</h3><p>'+E(n.content||'')+'</p><a href="notices.html">Read notice →</a></article>').join('')||'<p class="hint">No notices published.</p>';
    const homeGallery=document.getElementById('homeGallery');
    if(homeGallery) homeGallery.innerHTML=(galleryQ.data||[]).map(x=>'<div><img loading="lazy" src="'+E(x.image_url)+'" alt="'+E(x.title||'School gallery')+'"><small>'+E(x.title||x.description||'')+'</small></div>').join('')||'<p class="hint">Gallery photos will be published by the administration.</p>';
    const statEls=document.querySelectorAll('.stats strong');
    if(statEls.length>=4){statEls[0].textContent=String(s.student_count??fallback.students??'—');statEls[1].textContent=String(s.teacher_count??teachersQ.count??'—').padStart(2,'0');statEls[2].textContent=String(s.service_years??fallback.serviceYears??'—');statEls[3].textContent=String(s.ssc_pass_rate??fallback.passRate??'—');}
    const hero=document.querySelector('.hero');
    if(hero){
      const slides=(heroQ.data||[]).map(x=>x.image_url).filter(Boolean);
      const urls=slides.length?slides:['assets/images/hero/1.jpg','assets/images/hero/2.jpg'];
      const bg=hero.querySelector('.hero-bg');
      if(bg) bg.src=urls[0];
      if(urls.length>1){let i=0;setInterval(()=>{i=(i+1)%urls.length;const current=hero.querySelector('.hero-bg');if(current)current.src=urls[i]},5000);}
    }
  }
  loadPublicSite().catch(error=>console.error('MHS public Supabase content could not be loaded:',error));
})();