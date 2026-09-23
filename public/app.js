const state = { rows: [], filtered: [] };

const fmt = new Intl.NumberFormat('id-ID');
const updatedFmt = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Jakarta'
});

const body = document.querySelector('#rankingBody');
const search = document.querySelector('#search');
const limit = document.querySelector('#limit');
const notice = document.querySelector('#notice');

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function render() {
  const q = search.value.trim().toLowerCase();
  const max = Number(limit.value);

  state.filtered = state.rows.filter((user) => {
    if (!q) return true;
    return [user.login, user.name, user.location, user.bio]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });

  body.innerHTML = state.filtered.slice(0, max).map((user, index) => `
    <tr>
      <td class="rank">${index + 1}</td>
      <td>
        <div class="user">
          <img class="avatar" src="${esc(user.avatarUrl)}" alt="">
          <div>
            <a href="${esc(user.htmlUrl)}" target="_blank" rel="noreferrer">${esc(user.login)}</a>
            <small>${esc(user.name || user.location || 'GitHub user')}</small>
          </div>
        </div>
      </td>
      <td><span class="badge">🔥 <span class="streak">${fmt.format(user.longestStreak)}</span> hari</span></td>
      <td><span class="badge">⚡ ${fmt.format(user.currentStreak)} hari</span></td>
      <td>${fmt.format(user.totalContributions)}</td>
    </tr>
  `).join('');

  if (!state.filtered.length) {
    body.innerHTML = '<tr><td colspan="5" class="muted">Tidak ada user yang cocok.</td></tr>';
  }
}

async function load() {
  try {
    const response = await fetch('./data/ranking.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.rows = Array.isArray(data.ranking) ? data.ranking : [];

    document.querySelector('#userCount').textContent = fmt.format(state.rows.length);
    document.querySelector('#updatedAt').textContent = data.generatedAt
      ? updatedFmt.format(new Date(data.generatedAt))
      : '—';
    document.querySelector('#topStreak').textContent = state.rows.length
      ? `${fmt.format(state.rows[0].longestStreak)} hari`
      : '—';

    if (data.streakWindow?.from && data.streakWindow?.to) {
      const from = new Date(data.streakWindow.from).toLocaleDateString('id-ID');
      const to = new Date(data.streakWindow.to).toLocaleDateString('id-ID');
      document.querySelector('#window').textContent = `Window streak: ${from} – ${to}.`;
    }

    notice.style.display = 'block';
    notice.textContent = 'Definisi streak: minimal 1 contribution pada suatu hari di kalender kontribusi GitHub.';
    render();
  } catch (error) {
    notice.style.display = 'block';
    notice.textContent = `Data belum tersedia: ${error.message}`;
  }
}

search.addEventListener('input', render);
limit.addEventListener('change', render);
load();
