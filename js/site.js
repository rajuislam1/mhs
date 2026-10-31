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

  async function loadPublicSite() {
    let sb;
    try { sb = await withTimeout(window.mhsSupabaseReady, 9000); }
    catch (error) { console.warn('MHS database unavailable; showing saved school content.', error?.message || error); return; }

    const [settingsQ, noticesQ, tickerQ, galleryQ, heroQ, achievementsQ, teachersQ, statsQ] = await Promise.all([
      query(sb.from('school_settings').select('school_name,school_name_en,established_year,slogan,logo_url,phone,email,address,about_text,mission_text,vision_text,history_text,student_count,teacher_count,service_years,ssc_pass_rate').limit(1).maybeSingle(), 'school settings'),
      query(sb.from('notices').select('id,title,content,attachment_url,published_at,created_at').eq('is_published',true).order('published_at',{ascending:false}).limit(3), 'notices'),
      query(sb.from('notice_tickers').select('message,link_url').eq('is_active',true).order('display_order').limit(1).maybeSingle(), 'notice ticker'),
      query(sb.from('gallery').select('title,description,image_url,category').eq('is_published',true).order('display_order').limit(6), 'gallery'),
      query(sb.from('hero_images').select('image_url,title,alt_text,display_order').eq('is_active',true).order('display_order'), 'hero images'),
      query(sb.from('achievements').select('id',{count:'exact',head:true}).eq('is_published',true), 'achievements'),
      query(sb.from('teacher_public_profiles').select('id',{count:'exact',head:true}).eq('is_published',true), 'teacher profiles'),
      query(sb.from('school_public_statistics').select('active_students,active_teachers').eq('id',1).maybeSingle(), 'public statistics')
    ]);

    const s = settingsQ.data || {};
    setText('aboutText', s.about_text || fallback.about);

    const noticeList = noticesQ.data || [];
    const tickerMessage = tickerQ.data?.message || noticeList[0]?.title;
    if (ticker && tickerMessage) ticker.innerHTML = '<span>' + E(tickerMessage) + '</span>';

    const noticeCards = document.getElementById('noticeCards');
    if (noticeCards) noticeCards.innerHTML = noticeList.map(n =>
      '<article class="notice-card"><small>' + E(n.published_at || n.created_at ? new Date(n.published_at || n.created_at).toLocaleDateString('en-GB') : '') +
      '</small><h3>' + E(n.title) + '</h3><p>' + E(n.content || '') +
      '</p><a href="notices.html">Read notice →</a></article>'
    ).join('') || '<p class="hint">No notices published.</p>';

    const homeGallery = document.getElementById('homeGallery');
    if (homeGallery && galleryQ.data) homeGallery.innerHTML = galleryQ.data.map(x =>
      '<div><img loading="lazy" src="' + E(x.image_url) + '" alt="' + E(x.title || 'School gallery') +
      '"><small>' + E(x.title || x.description || '') + '</small></div>'
    ).join('') || '<p class="hint">Gallery photos will be published by the administration.</p>';

    const stats = statsQ.data;
    const statEls = document.querySelectorAll('.stats strong');
    if (statEls.length >= 4) {
      if (stats?.active_students != null) statEls[0].textContent = String(stats.active_students);
      if (stats?.active_teachers != null) statEls[1].textContent = String(stats.active_teachers).padStart(2,'0');
      statEls[2].textContent = String(s.service_years ?? fallback.serviceYears ?? '—');
      statEls[3].textContent = String(s.ssc_pass_rate ?? fallback.passRate ?? '—');
    }

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
