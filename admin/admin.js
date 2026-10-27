
/* ============================================================
   SUPABASE NOTICE MANAGEMENT
   Add this block at the END of the existing admin/admin.js
   ============================================================ */

let mhsNoticeRows = [];

async function mhsGetNoticeClient() {
  if (!window.mhsSupabaseReady) {
    throw new Error('Supabase client is not loaded. Check admin/index.html.');
  }
  return await window.mhsSupabaseReady;
}

function mhsNoticeFromDb(row) {
  return {
    id: row.id,
    title: row.title || '',
    date: row.published_at || row.created_at || new Date().toISOString(),
    description: row.content || '',
    file: row.attachment_url || '',
    is_published: row.is_published !== false
  };
}

function mhsNoticeMessage(message) {
  if (typeof window.mhsToast === 'function') {
    window.mhsToast(message);
  } else {
    alert(message);
  }
}

/* Load notices from Supabase */
async function notices() {
  app.innerHTML = '<div class="panel"><div class="box">Loading notices…</div></div>';

  try {
    const sb = await mhsGetNoticeClient();

    const { data, error } = await sb
      .from('notices')
      .select('id,title,content,notice_type,attachment_url,is_published,published_at,created_at,updated_at')
      .order('published_at', { ascending: false });

    if (error) throw error;

    mhsNoticeRows = (data || []).map(mhsNoticeFromDb);
  } catch (error) {
    console.error('Supabase notice loading failed:', error);
    app.innerHTML = `
      <div class="panel"><div class="box">
        <h2>Could not load notices</h2>
        <p>${esc(error.message || 'Supabase request failed.')}</p>
        <button type="button" onclick="notices()">Retry</button>
      </div></div>`;
    return;
  }

  const ticker = get('mhs_ticker_notice', {
    text: mhsNoticeRows[0]?.title || 'School notice'
  });

  app.innerHTML = `
    <div class="panel">

      <div class="box">
        <h2>Hero Notice Ticker</h2>
        <form class="form" id="mhsTickerForm">
          <label class="full">
            Ticker Notice Text
            <input id="mhsTickerText"
              value="${esc(ticker.text || '')}" required>
          </label>
          <button type="submit">Save Ticker Notice</button>
        </form>
        <p class="hint">
          Ticker text is currently saved in this browser, not Supabase.
        </p>
      </div>

      <div class="box">
        <h2>Add / Edit Notice</h2>
        <form class="form" id="mhsNoticeForm">
          <input type="hidden" id="mhsNoticeId">

          <label class="full">
            Notice Title
            <input id="mhsNoticeTitle" maxlength="250" required>
          </label>

          <label>
            Posting Date &amp; Time
            <input id="mhsNoticeDate" type="datetime-local" required>
          </label>

          <label>
            Attachment URL
            <input id="mhsNoticeFile"
              placeholder="Optional URL or relative file path">
          </label>

          <label class="full">
            Description
            <textarea id="mhsNoticeDescription" required></textarea>
          </label>

          <button type="submit">Save Notice to Supabase</button>
          <button type="button" id="mhsNoticeCancel" class="btn-small">
            Clear Form
          </button>
        </form>
      </div>

      <div class="box">
        <div class="toolbar">
          <h2>All Notices</h2>
          <span>${mhsNoticeRows.length} total</span>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Posted</th>
                <th>Attachment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${mhsNoticeRows.map((n, i) => `
                <tr>
                  <td>${esc(n.title)}</td>
                  <td>${new Date(n.date).toLocaleString()}</td>
                  <td>
                    ${n.file
                      ? `<a href="${esc(n.file)}" target="_blank" rel="noopener noreferrer">Open</a>`
                      : '—'}
                  </td>
                  <td>${n.is_published ? 'Published' : 'Draft'}</td>
                  <td>
                    <button type="button" class="btn-small"
                      onclick="editNotice(${i})">Edit</button>
                    <button type="button" class="btn-small danger"
                      onclick="delNotice(${i})">Delete</button>
                  </td>
                </tr>
              `).join('') ||
              '<tr><td colspan="5" class="empty-admin">No notices found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  document.getElementById('mhsTickerForm').onsubmit = e => {
    e.preventDefault();
    set('mhs_ticker_notice', {
      text: document.getElementById('mhsTickerText').value.trim(),
      updatedAt: new Date().toISOString()
    });
    mhsNoticeMessage('Ticker text saved in this browser.');
  };

  const dateInput = document.getElementById('mhsNoticeDate');

  dateInput.value = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
  ).toISOString().slice(0, 16);

  document.getElementById('mhsNoticeCancel').onclick = () => {
    document.getElementById('mhsNoticeForm').reset();
    document.getElementById('mhsNoticeId').value = '';
    dateInput.value = new Date(
      Date.now() - new Date().getTimezoneOffset() * 60000
    ).toISOString().slice(0, 16);
    document.querySelector('#mhsNoticeForm button[type="submit"]').textContent =
      'Save Notice to Supabase';
  };

  document.getElementById('mhsNoticeForm').onsubmit = async e => {
    e.preventDefault();

    const form = e.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const id = document.getElementById('mhsNoticeId').value.trim();
    const titleValue = document.getElementById('mhsNoticeTitle').value.trim();
    const dateValue = document.getElementById('mhsNoticeDate').value;
    const contentValue = document.getElementById('mhsNoticeDescription').value.trim();
    const attachmentValue = document.getElementById('mhsNoticeFile').value.trim();

    if (!titleValue || !dateValue || !contentValue) {
      alert('Title, date and description are required.');
      return;
    }

    const payload = {
      title: titleValue,
      content: contentValue,
      attachment_url: attachmentValue || null,
      published_at: new Date(dateValue).toISOString(),
      notice_type: 'general',
      is_published: true,
      updated_at: new Date().toISOString()
    };

    button.disabled = true;
    button.textContent = 'Saving…';

    try {
      const sb = await mhsGetNoticeClient();
      let result;

      if (id) {
        result = await sb
          .from('notices')
          .update(payload)
          .eq('id', id)
          .select('id')
          .maybeSingle();
      } else {
        result = await sb
          .from('notices')
          .insert(payload)
          .select('id')
          .single();
      }

      if (result.error) throw result.error;

      if (id && !result.data) {
        throw new Error('No notice was updated. Check admin permissions and RLS policies.');
      }

      mhsNoticeMessage(id
        ? 'Notice updated in Supabase.'
        : 'Notice saved to Supabase.');

      await notices();
    } catch (error) {
      console.error('Notice save failed:', error);
      alert('Notice was NOT saved: ' + (error.message || 'Supabase request failed.'));
      button.disabled = false;
      button.textContent = id
        ? 'Update Notice in Supabase'
        : 'Save Notice to Supabase';
    }
  };
}

/* Edit an existing Supabase notice */
window.editNotice = i => {
  const n = mhsNoticeRows[i];
  if (!n) return;

  document.getElementById('mhsNoticeId').value = n.id;
  document.getElementById('mhsNoticeTitle').value = n.title;

  const date = new Date(n.date);
  document.getElementById('mhsNoticeDate').value = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 16);

  document.getElementById('mhsNoticeFile').value = n.file || '';
  document.getElementById('mhsNoticeDescription').value = n.description || '';

  document.querySelector('#mhsNoticeForm button[type="submit"]').textContent =
    'Update Notice in Supabase';

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/* Delete a notice from Supabase */
window.delNotice = async i => {
  const n = mhsNoticeRows[i];

  if (!n || !confirm(`Delete notice "${n.title}"? This cannot be undone.`)) {
    return;
  }

  try {
    const sb = await mhsGetNoticeClient();

    const { data, error } = await sb
      .from('notices')
      .delete()
      .eq('id', n.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error('No notice was deleted. Check admin permissions and RLS policies.');
    }

    mhsNoticeMessage('Notice deleted from Supabase.');
    await notices();
  } catch (error) {
    console.error('Notice delete failed:', error);
    alert('Notice was NOT deleted: ' + (error.message || 'Supabase request failed.'));
  }
};
