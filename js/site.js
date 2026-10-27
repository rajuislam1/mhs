
/* ============================================================
   MOKHLESHPUR HIGH SCHOOL - PUBLIC SITE
   Supabase notices integration
   File: js/site.js
   ============================================================ */

const SITE_ACTIVE =
  JSON.parse(localStorage.getItem('mhs_site_settings') || 'null') || SITE;

const noticeData =
  JSON.parse(localStorage.getItem('mhs_notices') || 'null') || NOTICES;

const tickerCfg =
  JSON.parse(localStorage.getItem('mhs_ticker_notice') || 'null') || {
    text: noticeData[0]?.title || 'School notice'
  };

const escSite = value =>
  String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[ch]));

const ti = document.getElementById('tickerItems');

if (ti) {
  ti.innerHTML = `<span>${escSite(tickerCfg.text || 'School notice')}</span>`;
}

const ab = document.getElementById('aboutText');

if (ab) {
  ab.textContent = SITE_ACTIVE.about;
}

/* Initial local fallback */
const nc = document.getElementById('noticeCards');

if (nc) {
  nc.innerHTML = noticeData.slice(0, 3).map(n => `
    <article class="notice-card">
      <small>${new Date(n.date).toLocaleDateString('en-GB')}</small>
      <h3>${escSite(n.title)}</h3>
      <p>${escSite(n.description)}</p>
      <a href="notices.html">Read notice →</a>
    </article>
  `).join('');
}

/* School statistics */
const statVals = document.querySelectorAll('.stats strong');

if (statVals.length >= 4) {
  let students = [];
  let teachers = null;

  try {
    students = JSON.parse(localStorage.getItem('mhs_students') || '[]');
  } catch (_) {}

  try {
    teachers = JSON.parse(localStorage.getItem('mhs_teachers') || 'null');
  } catch (_) {}

  statVals[0].textContent = students.length;
  statVals[1].textContent = String((teachers || TEACHERS).length).padStart(2, '0');
  statVals[2].textContent = SITE_ACTIVE.serviceYears;
  statVals[3].textContent = SITE_ACTIVE.passRate;
}

/* Mobile menu */
document.getElementById('menu')?.addEventListener('click', () => {
  document.getElementById('nav')?.classList.toggle('open');
});

/* Hero slideshow */
(function () {
  const bg = document.querySelector('.hero-bg');
  if (!bg) return;

  let heroData = null;

  try {
    heroData = JSON.parse(localStorage.getItem('mhs_hero') || 'null');
  } catch (_) {}

  const images = (
    heroData === null
      ? ['assets/images/hero/1.jpg', 'assets/images/hero/2.jpg']
      : heroData.map(item => item.url)
  ).filter(Boolean);

  if (!images.length) return;

  const slides = images.map((url, index) => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.className = 'hero-slide' + (index === 0 ? ' on' : '');
    bg.before(img);
    return img;
  });

  bg.remove();

  if (slides.length > 1) {
    let index = 0;

    setInterval(() => {
      slides[index].classList.remove('on');
      index = (index + 1) % slides.length;
      slides[index].classList.add('on');
    }, 5000);
  }
})();

/* ============================================================
   LOAD PUBLISHED NOTICES FROM SUPABASE
   ============================================================ */

(async function loadPublicNotices() {
  const container = document.getElementById('noticeCards');

  if (!container) return;

  try {
    // Supabase client should be initialized by js/supabase.js.
    if (!window.mhsSupabaseReady) {
      throw new Error(
        'Supabase client is not initialized. Check index.html script order.'
      );
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

    container.innerHTML = rows.map(n => `
      <article class="notice-card">
        <small>
          ${new Date(n.published_at || n.created_at).toLocaleDateString('en-GB')}
        </small>
        <h3>${escSite(n.title)}</h3>
        <p>${escSite(n.content || '')}</p>
        <a href="notices.html">Read notice →</a>
      </article>
    `).join('') || '<p class="hint">No notices published.</p>';

  } catch (error) {
    console.error('Supabase notices could not be loaded:', error);
    // Keep the existing local fallback if the database is unavailable.
  }
})();
