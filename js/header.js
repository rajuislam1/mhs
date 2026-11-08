// Apply saved language before first paint to avoid a font flash.
try { const l=localStorage.getItem('mhs_lang')==='bn'?'bn':'en'; document.documentElement.lang=l; document.body.classList.add(l==='bn'?'lang-bn':'lang-en'); } catch (_) {}
document.write(`
<div class="topbar"><div data-en="EIIN: 120140 · Estd. 1962 · Dinajpur Education Board" data-bn="EIIN: ১২০১৪০ · স্থাপিত: ১৯৬২ · দিনাজপুর শিক্ষা বোর্ড">EIIN: 120140 · Estd. 1962 · Dinajpur Education Board</div><div><span>☎ 01752209431</span><span>✉ mokhleshpurhighschool@gmail.com</span></div></div>
<header class="header"><a class="brand" href="index.html"><img src="assets/images/logo.svg" alt="MHS"><div><b data-en="Mokhleshpur High School" data-bn="মোখলেশপুর উচ্চ বিদ্যালয়">Mokhleshpur High School</b><span data-en="Established 1962" data-bn="স্থাপিত ১৯৬২">Established 1962</span></div></a>
<div class="header-clock" aria-label="Bangladesh date and time"><div class="clock-date"><span class="clock-icon" aria-hidden="true">▦</span><span id="mhsHeaderDate">তারিখ লোড হচ্ছে…</span></div><div class="clock-time"><span class="clock-icon" aria-hidden="true">◷</span><strong id="mhsHeaderTime">--:-- --</strong><small>বাংলাদেশ সময়</small></div></div>
<div class="header-motto"><span class="motto-dot"></span><div><b data-en="Learning for All" data-bn="সবার জন্য শিক্ষা">Learning for All</b><small data-en="A legacy of learning since 1962" data-bn="১৯৬২ সাল থেকে শিক্ষার ঐতিহ্য">A legacy of learning since 1962</small></div><strong>EIIN 120140</strong></div>
<button class="menu" id="menu" type="button" aria-label="Open menu" aria-expanded="false">☰</button>
<nav id="nav">
<a href="index.html" data-en="Home" data-bn="হোম">Home</a>
<a href="notices.html" data-en="Notices" data-bn="নোটিশ">Notices</a>
<div class="nav-dropdown"><button class="nav-drop-trigger" type="button" data-en="Teachers & Staff ▾" data-bn="শিক্ষক ও কর্মচারী ▾">Teachers & Staff ▾</button><div class="nav-drop-menu">
<a href="teachers.html" data-en="All Staff" data-bn="সকল শিক্ষক ও কর্মচারী">All Staff</a>
<a href="teachers.html?category=headteacher" data-en="Headteacher" data-bn="প্রধান শিক্ষক">Headteacher</a>
<a href="teachers.html?category=teacher" data-en="Teachers" data-bn="শিক্ষক">Teachers</a>
<a href="teachers.html?category=assistant" data-en="Assistant Teachers" data-bn="সহকারী শিক্ষক">Assistant Teachers</a>
<a href="teachers.html?category=staff" data-en="Employees" data-bn="কর্মচারী">Employees</a>
</div></div>
<div class="nav-dropdown"><button class="nav-drop-trigger" type="button" data-en="Sports & Training ▾" data-bn="ক্রীড়া ও প্রশিক্ষণ ▾">Sports & Training ▾</button><div class="nav-drop-menu">
<a href="gallery.html?category=sports" data-en="Annual Sports" data-bn="বার্ষিক ক্রীড়া প্রতিযোগিতা">Annual Sports</a>
<a href="gallery.html?category=cultural" data-en="Cultural Programmes" data-bn="সাংস্কৃতিক অনুষ্ঠান">Cultural Programmes</a>
<a href="gallery.html?category=science" data-en="Science Fair" data-bn="বিজ্ঞান মেলা">Science Fair</a>
<a href="gallery.html?category=national" data-en="National Days" data-bn="জাতীয় দিবস উদযাপন">National Days</a>
<a href="gallery.html?category=awards" data-en="Award Ceremony" data-bn="পুরস্কার বিতরণী">Award Ceremony</a>
<a href="gallery.html?category=tour" data-en="Study Tours" data-bn="শিক্ষা সফর">Study Tours</a>
</div></div>
<a href="gallery.html" data-en="Gallery" data-bn="গ্যালারি">Gallery</a><a href="results.html" data-en="Results" data-bn="ফলাফল">Results</a>
<a href="student-corner.html" data-en="Student & Parent Corner" data-bn="শিক্ষার্থী ও অভিভাবক কর্নার">Student & Parent Corner</a>
<a href="calendar.html" data-en="Academic Calendar" data-bn="শিক্ষাপঞ্জি">Academic Calendar</a>
<a href="student/login.html" data-en="Student Portal Login" data-bn="শিক্ষার্থী লগইন">Student Portal Login</a><a href="admission.html" data-en="Admission" data-bn="ভর্তি">Admission</a>
<button class="lang-btn" id="langToggle" type="button">বাংলা</button>
</nav></header><div class="ticker"><strong data-en="NOTICE" data-bn="নোটিশ">NOTICE</strong><div id="tickerItems"></div></div>`);
(function(){
 const menu=document.getElementById('menu'),nav=document.getElementById('nav');
 const dateEl=document.getElementById('mhsHeaderDate'),timeEl=document.getElementById('mhsHeaderTime');
 const updateClock=()=>{const now=new Date(),options={timeZone:'Asia/Dhaka'};if(dateEl)dateEl.textContent=new Intl.DateTimeFormat('bn-BD',{...options,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now);if(timeEl)timeEl.textContent=new Intl.DateTimeFormat('bn-BD',{...options,hour:'2-digit',minute:'2-digit',hour12:true}).format(now);};
 updateClock();window.setInterval(updateClock,30000);
 menu?.addEventListener('click',()=>{const open=nav?.classList.toggle('open');menu.setAttribute('aria-expanded',String(!!open));});
 document.querySelectorAll('.nav-drop-trigger').forEach(btn=>btn.addEventListener('click',()=>btn.parentElement.classList.toggle('expanded')));
 document.getElementById('langToggle')?.addEventListener('click',()=>window.MHS_I18N?.toggle());
 // Load scripts through DOM APIs. Avoid malformed document.write closing-script tags,
 // which can make the browser consume the rest of the page as script text.
 ['js/i18n.js','js/ticker.js'].forEach(src=>{const script=document.createElement('script');script.src=src;script.async=false;document.head.appendChild(script);});
})();
