// ===== API INTEGRATION GUIDE =====
// Replace these functions in your HTML file with API calls

// ===== MEMBER FUNCTIONS =====

async function daftar() {
  const nama = document.getElementById('r-nama').value.trim();
  const hp = document.getElementById('r-hp').value.trim();
  const pin = document.getElementById('r-pin').value.trim();

  if (!nama || !hp || !pin || pin.length !== 4) {
    toast('Isi semua field dengan benar');
    return;
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama, hp, pin })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    toast('Registrasi berhasil!');
    document.getElementById('r-nama').value = '';
    document.getElementById('r-hp').value = '';
    document.getElementById('r-pin').value = '';
    showPage('dashboard');
    loadMemberProfile();
  } catch (err) {
    toast(err.message || 'Gagal registrasi');
  }
}

async function loginMember() {
  const hp = document.getElementById('lm-hp').value.trim();
  const pin = document.getElementById('lm-pin').value.trim();

  if (!hp || !pin) {
    toast('Masukkan nomor HP dan PIN');
    return;
  }

  try {
    const res = await fetch('/api/member/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hp, pin })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    toast('Login berhasil!');
    document.getElementById('lm-hp').value = '';
    document.getElementById('lm-pin').value = '';
    showPage('dashboard');
    loadMemberProfile();
  } catch (err) {
    toast(err.message || 'Login gagal');
  }
}

async function loadMemberProfile() {
  try {
    const res = await fetch('/api/member/profile');
    
    if (!res.ok) {
      showPage('landing');
      return;
    }

    const member = await res.json();

    document.getElementById('m-nama').textContent = member.nama;
    document.getElementById('m-poin').textContent = member.poin;
    document.getElementById('m-id').textContent = 'ID: ' + member.id;

    // Update tier
    const tier = getTier(member.poin);
    document.getElementById('m-tier').className = 'tier-badge ' + tier.cls;
    document.getElementById('m-tier').textContent = tier.label;
    document.getElementById('m-tier-cur').textContent = tier.label;

    // Update progress
    const nextTier = tier.next;
    const nextPoints = nextTier === 'Silver' ? 100 : 300;
    document.getElementById('m-tier-nxt').textContent = nextTier + ' (' + nextPoints + ' poin)';
    const progress = Math.min(100, (member.poin / nextPoints) * 100);
    document.getElementById('m-prog').style.width = progress + '%';
    document.getElementById('m-prog-msg').textContent = member.poin + ' / ' + nextPoints + ' poin';

    // Load transactions
    loadMemberTransactions();
  } catch (err) {
    console.error('Error loading profile:', err);
    showPage('landing');
  }
}

async function loadMemberTransactions() {
  try {
    const res = await fetch('/api/member/transactions');
    const transactions = await res.json();

    const el = document.getElementById('m-tx-list');
    if (!transactions.length) {
      el.innerHTML = '<div style="text-align:center;padding:18px 0;color:var(--muted);font-size:13px;">Belum ada transaksi</div>';
      return;
    }

    el.innerHTML = transactions.map(tx => {
      const isRedeem = tx.tipe === 'redeem';
      const icon = isRedeem ? '−' : '+';
      const color = isRedeem ? 'minus' : '';
      return `<div class="tx">
        <div class="tx-info">
          <div class="tx-nama">${isRedeem ? tx.ket : 'Belanja'}</div>
          <div class="tx-date">${formatDate(tx.tgl)}${tx.waktu ? ' ' + tx.waktu : ''}</div>
          <div class="tx-nom">${tx.nominal ? formatRp(tx.nominal) : 'Penukaran'}</div>
        </div>
        <div class="tx-poin ${color}">${icon}${Math.abs(tx.poin)}</div>
      </div>`;
    }).join('');
  } catch (err) {
    console.error('Error loading transactions:', err);
  }
}

async function loadHadiah() {
  try {
    const res = await fetch('/api/hadiah');
    const hadiah = await res.json();

    const el = document.getElementById('m-hadiah-list');
    const colors = ['pink', 'caramel', 'dark', 'caramel', 'pink'];

    el.innerHTML = hadiah.map((h, i) => {
      const color = colors[i % colors.length];
      return `<div class="hadiah-card ${color}">
        <div class="hadiah-judul">${h.nama}</div>
        <div class="hadiah-desc">${h.desc || ''}</div>
        <div class="hadiah-footer">
          <div class="hadiah-poin">${h.poin} poin</div>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    console.error('Error loading hadiah:', err);
  }
}

function confirmLogout(type) {
  showModal('Keluar?', 'Apakah Anda yakin ingin keluar?', () => {
    logoutMember(type);
  });
}

async function logoutMember(type) {
  try {
    const endpoint = type === 'member' ? '/api/member/logout' : '/api/karyawan/logout';
    await fetch(endpoint, { method: 'POST' });
    showPage('landing');
  } catch (err) {
    console.error('Logout error:', err);
  }
}

// ===== KARYAWAN FUNCTIONS =====

async function loginKaryawan() {
  const username = document.getElementById('lk-user').value.trim();
  const password = document.getElementById('lk-pass').value.trim();

  if (!username || !password) {
    toast('Masukkan username dan password');
    return;
  }

  try {
    const res = await fetch('/api/karyawan/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    toast('Login berhasil!');
    document.getElementById('lk-user').value = '';
    document.getElementById('lk-pass').value = '';
    showPage('karyawan');
    document.getElementById('k-label').textContent = 'Halo, ' + data.user.nama + '!';
    document.getElementById('tx-tgl').value = getTodayString();
    loadHadiahList();
  } catch (err) {
    toast(err.message || 'Login gagal');
  }
}

async function cariMemberTx() {
  const id = document.getElementById('tx-id').value.trim();
  const infoEl = document.getElementById('tx-member-info');
  const nfEl = document.getElementById('tx-not-found');

  if (!id) {
    toast('Masukkan nomor HP');
    return;
  }

  try {
    const res = await fetch(`/api/karyawan/search-member/${id}`);
    
    if (!res.ok) {
      infoEl.style.display = 'none';
      nfEl.style.display = 'block';
      return;
    }

    const member = await res.json();
    const tier = getTier(member.poin);

    infoEl.innerHTML = `
      <div class="preview-row"><span>Nama</span><span class="val">${member.nama}</span></div>
      <div class="preview-row"><span>Poin saat ini</span><span class="val">${member.poin} poin</span></div>
      <div class="preview-row"><span>Tier</span><span class="val">${tier.label}</span></div>
    `;
    infoEl.style.display = 'block';
    nfEl.style.display = 'none';
    document.getElementById('tx-nominal').value = '';
  } catch (err) {
    infoEl.style.display = 'none';
    nfEl.style.display = 'block';
  }
}

async function hitungLaluSimpan() {
  const memberId = document.getElementById('tx-id').value.trim();
  const tgl = document.getElementById('tx-tgl').value;
  const nominal = parseInt(document.getElementById('tx-nominal').value) || 0;

  if (!memberId || !tgl || nominal <= 0) {
    toast('Isi semua field dengan benar');
    return;
  }

  const poin = Math.floor(nominal / 25000);
  const preview = document.getElementById('tx-poin-preview');

  preview.innerHTML = `
    <div class="preview-row"><span>Nominal</span><span class="val">${formatRp(nominal)}</span></div>
    <div class="preview-row"><span>Poin didapat</span><span class="val">+${poin} poin</span></div>
  `;
  preview.style.display = 'block';

  const bodyHTML = `
    <div class="preview">
      <div class="preview-row"><span>Member</span><span class="val">${document.getElementById('tx-id').value}</span></div>
      <div class="preview-row"><span>Nominal</span><span class="val">${formatRp(nominal)}</span></div>
      <div class="preview-row"><span>Poin didapat</span><span class="val">+${poin} poin</span></div>
    </div>
  `;

  showModal('Simpan Transaksi?', bodyHTML, async () => {
    try {
      const res = await fetch('/api/karyawan/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, tgl, nominal, poin })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast(`+${poin} poin untuk member`);
      document.getElementById('tx-id').value = '';
      document.getElementById('tx-nominal').value = '';
      document.getElementById('tx-member-info').style.display = 'none';
      preview.style.display = 'none';
    } catch (err) {
      toast(err.message || 'Gagal menyimpan transaksi');
    }
  });
}

async function cariMemberRdm() {
  const id = document.getElementById('rdm-id').value.trim();
  const infoEl = document.getElementById('rdm-member-info');
  const nfEl = document.getElementById('rdm-not-found');
  const hadEl = document.getElementById('rdm-hadiah-list');

  if (!id) {
    toast('Masukkan nomor HP');
    return;
  }

  try {
    const res = await fetch(`/api/karyawan/search-member/${id}`);
    
    if (!res.ok) {
      infoEl.style.display = 'none';
      nfEl.style.display = 'block';
      hadEl.style.display = 'none';
      return;
    }

    const member = await res.json();
    const tier = getTier(member.poin);

    infoEl.innerHTML = `
      <div class="preview-row"><span>Nama</span><span class="val">${member.nama}</span></div>
      <div class="preview-row"><span>Poin saat ini</span><span class="val">${member.poin} poin</span></div>
      <div class="preview-row"><span>Tier</span><span class="val">${tier.label}</span></div>
    `;
    infoEl.style.display = 'block';
    nfEl.style.display = 'none';
    
    await renderHadiahUntukRdm(id, member.poin);
    hadEl.style.display = 'block';
  } catch (err) {
    infoEl.style.display = 'none';
    nfEl.style.display = 'block';
    hadEl.style.display = 'none';
  }
}

async function renderHadiahUntukRdm(memberId, memberPoin) {
  try {
    const res = await fetch('/api/hadiah');
    const hadiah = await res.json();

    const hadEl = document.getElementById('rdm-hadiah-list');
    const colors = ['pink', 'caramel', 'dark', 'caramel', 'pink'];

    let html = '';
    hadiah.forEach((h, i) => {
      const cukup = memberPoin >= h.poin;
      const color = colors[i % colors.length];
      const className = cukup ? 'hadiah-card ' + color + ' clickable' : 'hadiah-card ' + color + ' disabled';

      html += `<div class="${className}" onclick="${cukup ? `prosesRedeem(${h.id}, '${memberId}')` : ''}">
        <div class="hadiah-judul">${h.nama}</div>
        <div class="hadiah-desc">${h.desc || ''}</div>
        <div class="hadiah-footer">
          <div class="hadiah-poin">${h.poin} poin</div>
          ${!cukup ? '<div class="hadiah-warn">Poin tidak cukup</div>' : ''}
        </div>
      </div>`;
    });

    hadEl.innerHTML = html;
  } catch (err) {
    console.error('Error rendering hadiah:', err);
  }
}

async function prosesRedeem(hadiahId, memberId) {
  try {
    const res = await fetch('/api/hadiah');
    const hadiah = await res.json();
    const h = hadiah.find(x => x.id === hadiahId);

    if (!h) {
      toast('Hadiah tidak ditemukan');
      return;
    }

    const bodyHTML = `
      <div class="alert alert-warn" style="margin-bottom:12px;">Pastikan struk fisik sudah dicek sebelum melanjutkan.</div>
      <div class="preview">
        <div class="preview-row"><span>Hadiah</span><span class="val">${h.nama}</span></div>
        <div class="preview-row"><span>Poin dipotong</span><span class="val">−${h.poin} poin</span></div>
      </div>
    `;

    showModal('Konfirmasi Penukaran?', bodyHTML, async () => {
      try {
        const redeemRes = await fetch('/api/karyawan/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId, hadiahId })
        });

        const data = await redeemRes.json();
        if (!redeemRes.ok) throw new Error(data.error);

        toast('Redeem berhasil: ' + h.nama);
        document.getElementById('rdm-id').value = '';
        document.getElementById('rdm-member-info').style.display = 'none';
        document.getElementById('rdm-hadiah-list').style.display = 'none';
      } catch (err) {
        toast(err.message || 'Gagal redeem');
      }
    });
  } catch (err) {
    console.error('Error processing redeem:', err);
  }
}

async function loadHadiahList() {
  try {
    const res = await fetch('/api/hadiah');
    const hadiah = await res.json();
    // Store for use in renderHadiahUntukRdm
    window.hadiah = hadiah;
  } catch (err) {
    console.error('Error loading hadiah:', err);
  }
}

// ===== ADMIN FUNCTIONS =====

async function pinTap(k) {
  if (k === 'del') {
    window.pinBuf = (window.pinBuf || '').slice(0, -1);
    updatePinDots();
    return;
  }
  if (k === 'ok') {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: window.pinBuf || '' })
      });

      const data = await res.json();
      if (!res.ok) {
        toast('PIN salah');
        window.pinBuf = '';
        updatePinDots();
        return;
      }

      window.pinBuf = '';
      updatePinDots();
      renderAdmin();
      showPage('admin');
    } catch (err) {
      toast('Gagal login admin');
    }
    return;
  }
  if ((window.pinBuf || '').length >= 4) return;
  window.pinBuf = (window.pinBuf || '') + k;
  updatePinDots();
  if ((window.pinBuf || '').length === 4) {
    setTimeout(() => pinTap('ok'), 200);
  }
}

async function renderAdmin() {
  try {
    const res = await fetch('/api/admin/dashboard');
    const data = await res.json();

    document.getElementById('s-mem').textContent = data.totalMembers;
    document.getElementById('s-tx').textContent = data.totalTransactions;
    document.getElementById('s-rdm').textContent = data.totalRedeem;
    document.getElementById('s-poin-beredar').textContent = data.poinBeredar;
    document.getElementById('s-poin-keluar').textContent = data.poinKeluar;
    document.getElementById('s-omset').textContent = data.omset >= 1000000
      ? (data.omset / 1000000).toFixed(1) + 'jt'
      : Math.floor(data.omset / 1000) + 'rb';
    
    await loadAdminDashboardExtras();
  } catch (err) {
    console.error('Error rendering admin dashboard:', err);
  }
}

async function logoutAdmin() {
  try {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.pinBuf = '';
    showPage('landing');
  } catch (err) {
    console.error('Logout error:', err);
  }
}

// ===== HELPER FUNCTIONS =====

function getTier(poin) {
  if (poin >= 300) return { label: '🥇 Gold', cls: 't-gold', next: 'Platinum' };
  if (poin >= 100) return { label: '🥈 Silver', cls: 't-silver', next: 'Gold' };
  return { label: '🥉 Bronze', cls: 't-bronze', next: 'Silver' };
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return date.getDate() + ' ' + months[date.getMonth()];
}

function formatRp(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value);
}

function getTodayString() {
  const today = new Date();
  return today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const d = document.getElementById('pd' + i);
    if (i < (window.pinBuf || '').length) d.classList.add('on');
    else d.classList.remove('on');
  }
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/session');
    const session = await res.json();

    if (session.logged) {
      if (session.userType === 'member') {
        showPage('dashboard');
        loadMemberProfile();
      } else if (session.userType === 'karyawan') {
        showPage('karyawan');
        document.getElementById('k-label').textContent = 'Halo, ' + session.userName + '!';
        document.getElementById('tx-tgl').value = getTodayString();
        loadHadiahList();
      } else if (session.userType === 'admin') {
        showPage('admin');
      }
    }
  } catch (err) {
    console.log('No active session');
  }
});


// ===== DELETE MEMBER (ADMIN ONLY) =====

async function confirmDeleteMember(memberId, memberName) {
  const bodyHTML = `
    <div class="alert alert-warn" style="margin-bottom:12px;">
      ⚠️ Tindakan ini tidak bisa dibatalkan. Semua data transaksi member akan dihapus juga.
    </div>
    <div class="preview">
      <div class="preview-row"><span>Member</span><span class="val">${memberName}</span></div>
      <div class="preview-row"><span>ID/Nomor HP</span><span class="val">${memberId}</span></div>
    </div>
  `;

  showModal('Hapus Member?', bodyHTML, async () => {
    await deleteMember(memberId);
  }, 'Hapus', 'Batal');
}

async function deleteMember(memberId) {
  try {
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();
    
    if (!res.ok) {
      toast(data.error || 'Gagal menghapus member');
      return;
    }

    toast('Member berhasil dihapus');
    renderMemberList();
  } catch (err) {
    console.error('Delete member error:', err);
    toast('Error: ' + err.message);
  }
}


// ===== PAGE & UI NAVIGATION =====

function showPage(pageName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('show'));
  const page = document.getElementById('pg-' + pageName);
  if (page) {
    page.classList.add('show');
    if (pageName === 'admin') {
      renderAdmin();
      aTab('r');
    }
  }
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  menu.classList.toggle('show');
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
  } else {
    input.type = 'password';
  }
}

function toast(message) {
  const toastEl = document.getElementById('toast');
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
  }, 3000);
}

// ===== MODAL =====

function showModal(title, body, okCallback, okText = 'Lanjutkan', cancelText = 'Batal') {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.querySelector('[id="modal-title"]');
  const bodyEl = document.getElementById('modal-body');
  const okBtn = document.getElementById('modal-ok');
  const cancelBtn = document.getElementById('modal-cancel');

  titleEl.textContent = title;
  bodyEl.innerHTML = body;
  okBtn.textContent = okText;
  cancelBtn.textContent = cancelText;

  okBtn.onclick = async () => {
    if (okCallback) {
      await okCallback();
    }
    closeModal();
  };

  overlay.style.display = 'flex';
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'none';
}

// ===== MEMBER TABS =====

function mTab(tab) {
  document.getElementById('panel-riwayat').style.display = tab === 'riwayat' ? 'block' : 'none';
  document.getElementById('panel-hadiah').style.display = tab === 'hadiah' ? 'block' : 'none';
  document.getElementById('tab-riwayat').classList.toggle('on', tab === 'riwayat');
  document.getElementById('tab-hadiah').classList.toggle('on', tab === 'hadiah');

  if (tab === 'hadiah') {
    loadHadiah();
  }
}

// ===== KARYAWAN TABS & HISTORY =====

function kTab(tab) {
  document.getElementById('kpanel-tx').style.display = tab === 'tx' ? 'block' : 'none';
  document.getElementById('kpanel-rdm').style.display = tab === 'rdm' ? 'block' : 'none';
  document.getElementById('kpanel-his').style.display = tab === 'his' ? 'block' : 'none';

  document.getElementById('ktab-tx').classList.toggle('on', tab === 'tx');
  document.getElementById('ktab-rdm').classList.toggle('on', tab === 'rdm');
  document.getElementById('ktab-his').classList.toggle('on', tab === 'his');

  if (tab === 'his') {
    setKRange('today');
    loadMembersForKaryawaFilter();
    renderRiwayatKaryawan();
  }
}

function kHisTab(type) {
  document.getElementById('khtab-all').classList.toggle('on', type === 'all');
  document.getElementById('khtab-tambah').classList.toggle('on', type === 'tambah');
  document.getElementById('khtab-redeem').classList.toggle('on', type === 'redeem');
  window.kHistoryType = type;
  renderRiwayatKaryawan();
}

window.kRange = 'today';
window.kHistoryType = 'all';

function setKRange(range) {
  window.kRange = range;
  document.querySelectorAll('#k-range-btns .range-btn').forEach((btn, idx) => {
    const ranges = ['today', 'week', 'month', '6month', 'all', 'custom'];
    btn.classList.toggle('on', ranges[idx] === range);
  });

  document.getElementById('k-custom-range').style.display = range === 'custom' ? 'flex' : 'none';
  renderRiwayatKaryawan();
}

async function loadMembersForKaryawaFilter() {
  try {
    const res = await fetch('/api/karyawan/members?t=' + Date.now());
    const members = await res.json();
    const select = document.getElementById('k-member-select');
    
    select.innerHTML = '<option value="">— Semua Member —</option>';
    members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.nama + ' (' + m.id + ')';
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Error loading members:', err);
  }
}

function getKDateRange() {
  const today = new Date();
  let from, to = today;

  switch(window.kRange) {
    case 'today':
      from = new Date(today);
      break;
    case 'week':
      from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case '6month':
      from = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
      from = new Date('2020-01-01');
      break;
    case 'custom':
      const dari = document.getElementById('k-tgl-dari').value;
      const sampai = document.getElementById('k-tgl-sampai').value;
      from = dari ? new Date(dari + 'T00:00:00') : new Date('2020-01-01');
      to = sampai ? new Date(sampai + 'T23:59:59') : today;
      break;
  }

  return { from, to };
}

async function renderRiwayatKaryawan() {
  try {
    const res = await fetch('/api/karyawan/transactions?t=' + Date.now());
    const transactions = await res.json();

    const range = getKDateRange();
    const memberId = document.getElementById('k-member-select').value;
    const historyType = window.kHistoryType;

    let filtered = transactions.filter(t => {
      const tDate = new Date(t.tgl + 'T00:00:00');
      if (tDate < range.from || tDate > range.to) return false;
      if (memberId && t.memberId !== memberId) return false;
      if (historyType === 'tambah' && t.tipe !== 'tambah') return false;
      if (historyType === 'redeem' && t.tipe !== 'redeem') return false;
      return true;
    });

    // Calculate summary
    const summary = {
      count: filtered.length,
      totalPoinMasuk: filtered.filter(t => t.tipe === 'tambah').reduce((sum, t) => sum + t.poin, 0),
      totalNominal: filtered.filter(t => t.tipe === 'tambah').reduce((sum, t) => sum + (t.nominal || 0), 0),
      totalPoinKeluar: filtered.filter(t => t.tipe === 'redeem').reduce((sum, t) => sum + Math.abs(t.poin), 0)
    };

    const summaryEl = document.getElementById('k-his-summary');
    if (summary.count > 0) {
      summaryEl.innerHTML = `
        <div class="preview-row"><span>Total Transaksi</span><span class="val">${summary.count}</span></div>
        <div class="preview-row"><span>Poin Masuk</span><span class="val">+${summary.totalPoinMasuk}</span></div>
        <div class="preview-row"><span>Nominal</span><span class="val">${formatRp(summary.totalNominal)}</span></div>
        <div class="preview-row"><span>Poin Keluar</span><span class="val" style="color:#E74C3C;">−${summary.totalPoinKeluar}</span></div>
      `;
      summaryEl.style.display = 'block';
    } else {
      summaryEl.style.display = 'none';
    }

    // Render list
    const el = document.getElementById('k-his-list');
    if (!filtered.length) {
      el.innerHTML = '<div style="text-align:center;padding:18px 0;color:var(--muted);font-size:13px;">Tidak ada transaksi</div>';
      return;
    }

    el.innerHTML = filtered.map(t => {
      const isRedeem = t.tipe === 'redeem';
      const icon = isRedeem ? '−' : '+';
      const color = isRedeem ? 'minus' : '';
      return `<div class="tx">
        <div class="tx-info">
          <div class="tx-nama">${isRedeem ? (t.ket || 'Redeem') : 'Belanja'}</div>
          <div class="tx-date">${formatDate(t.tgl)}${t.waktu ? ' ' + t.waktu : ''}</div>
          <div class="tx-nom">${t.nominal ? formatRp(t.nominal) : t.memberNama}</div>
        </div>
        <div class="tx-poin ${color}">${icon}${Math.abs(t.poin)}</div>
      </div>`;
    }).join('');
  } catch (err) {
    console.error('Error rendering history:', err);
    document.getElementById('k-his-list').innerHTML = '<div style="color:red;padding:10px;">Error loading data</div>';
  }
}

// ===== ADMIN TABS & AUDIT =====

function aTab(tab) {
  document.getElementById('apanel-r').style.display = tab === 'r' ? 'block' : 'none';
  document.getElementById('apanel-m').style.display = tab === 'm' ? 'block' : 'none';
  document.getElementById('apanel-a').style.display = tab === 'a' ? 'block' : 'none';
  document.getElementById('apanel-s').style.display = tab === 's' ? 'block' : 'none';

  document.getElementById('atab-r').classList.toggle('on', tab === 'r');
  document.getElementById('atab-m').classList.toggle('on', tab === 'm');
  document.getElementById('atab-a').classList.toggle('on', tab === 'a');
  document.getElementById('atab-s').classList.toggle('on', tab === 's');

  if (tab === 'm') {
    renderMemberList();
  } else if (tab === 'a') {
    setARange('today');
    loadMembersForAdminFilter();
    renderAudit();
  }
}

function aHisTab(type) {
  document.getElementById('atab-all').classList.toggle('on', type === 'all');
  document.getElementById('atab-tambah').classList.toggle('on', type === 'tambah');
  document.getElementById('atab-redeem').classList.toggle('on', type === 'redeem');
  window.aHistoryType = type;
  renderAudit();
}

window.aRange = 'today';
window.aHistoryType = 'all';

function setARange(range) {
  window.aRange = range;
  document.querySelectorAll('#a-range-btns .range-btn').forEach((btn, idx) => {
    const ranges = ['today', 'week', 'month', '6month', 'all', 'custom'];
    btn.classList.toggle('on', ranges[idx] === range);
  });

  document.getElementById('a-custom-range').style.display = range === 'custom' ? 'flex' : 'none';
  renderAudit();
}

async function loadMembersForAdminFilter() {
  try {
    const res = await fetch('/api/admin/members?t=' + Date.now());
    const members = await res.json();
    const select = document.getElementById('a-member-select');
    
    select.innerHTML = '<option value="">— Semua Member —</option>';
    members.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.nama + ' (' + m.id + ')';
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Error loading members:', err);
  }
}

function getADateRange() {
  const today = new Date();
  let from, to = today;

  switch(window.aRange) {
    case 'today':
      from = new Date(today);
      break;
    case 'week':
      from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case '6month':
      from = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
      from = new Date('2020-01-01');
      break;
    case 'custom':
      const dari = document.getElementById('a-tgl-dari').value;
      const sampai = document.getElementById('a-tgl-sampai').value;
      from = dari ? new Date(dari + 'T00:00:00') : new Date('2020-01-01');
      to = sampai ? new Date(sampai + 'T23:59:59') : today;
      break;
  }

  return { from, to };
}

async function renderAudit() {
  try {
    const res = await fetch('/api/admin/transactions?t=' + Date.now());
    const transactions = await res.json();

    const range = getADateRange();
    const memberId = document.getElementById('a-member-select').value;
    const historyType = window.aHistoryType;

    let filtered = transactions.filter(t => {
      const tDate = new Date(t.tgl + 'T00:00:00');
      if (tDate < range.from || tDate > range.to) return false;
      if (memberId && t.memberId !== memberId) return false;
      if (historyType === 'tambah' && t.tipe !== 'tambah') return false;
      if (historyType === 'redeem' && t.tipe !== 'redeem') return false;
      return true;
    });

    // Calculate summary
    const summary = {
      count: filtered.length,
      totalPoinMasuk: filtered.filter(t => t.tipe === 'tambah').reduce((sum, t) => sum + t.poin, 0),
      totalNominal: filtered.filter(t => t.tipe === 'tambah').reduce((sum, t) => sum + (t.nominal || 0), 0),
      totalPoinKeluar: filtered.filter(t => t.tipe === 'redeem').reduce((sum, t) => sum + Math.abs(t.poin), 0)
    };

    const summaryEl = document.getElementById('a-his-summary');
    if (summary.count > 0) {
      summaryEl.innerHTML = `
        <div class="preview-row"><span>Total Transaksi</span><span class="val">${summary.count}</span></div>
        <div class="preview-row"><span>Poin Masuk</span><span class="val">+${summary.totalPoinMasuk}</span></div>
        <div class="preview-row"><span>Nominal</span><span class="val">${formatRp(summary.totalNominal)}</span></div>
        <div class="preview-row"><span>Poin Keluar</span><span class="val" style="color:#E74C3C;">−${summary.totalPoinKeluar}</span></div>
      `;
      summaryEl.style.display = 'block';
    } else {
      summaryEl.style.display = 'none';
    }

    // Render list
    const el = document.getElementById('a-his-list');
    if (!filtered.length) {
      el.innerHTML = '<div style="text-align:center;padding:18px 0;color:var(--muted);font-size:13px;">Tidak ada transaksi</div>';
      return;
    }

    el.innerHTML = filtered.map(t => {
      const isRedeem = t.tipe === 'redeem';
      const icon = isRedeem ? '−' : '+';
      const color = isRedeem ? 'minus' : '';
      return `<div class="tx">
        <div class="tx-info">
          <div class="tx-nama">${t.memberNama || 'N/A'} ${isRedeem ? '→' : '← '} ${isRedeem ? (t.ket || 'Redeem') : 'Belanja'}</div>
          <div class="tx-date">${formatDate(t.tgl)}${t.waktu ? ' ' + t.waktu : ''}</div>
          <div class="tx-nom">${t.nominal ? formatRp(t.nominal) : ''} ${t.kary ? '(' + t.kary + ')' : ''}</div>
        </div>
        <div class="tx-poin ${color}">${icon}${Math.abs(t.poin)}</div>
      </div>`;
    }).join('');
  } catch (err) {
    console.error('Error rendering audit:', err);
    document.getElementById('a-his-list').innerHTML = '<div style="color:red;padding:10px;">Error loading data</div>';
  }
}

// ===== MEMBER MANAGEMENT =====

async function renderMemberList() {
  const search = (document.getElementById('a-cari').value || '').toLowerCase();

  try {
    // Force fresh data - add timestamp to bypass any caching
    const res = await fetch('/api/admin/members?t=' + Date.now());
    const members = await res.json();

    let filtered = members;
    if (search) {
      filtered = members.filter(m => 
        m.nama.toLowerCase().includes(search) || 
        m.id.includes(search)
      );
    }

    const el = document.getElementById('a-member-list');
    if (!filtered.length) {
      el.innerHTML = '<div style="text-align:center;padding:18px 0;color:var(--muted);font-size:13px;">Tidak ada member</div>';
      return;
    }

    el.innerHTML = filtered.map(m => `
      <div style="padding:12px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--brown);">${m.nama}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">ID: ${m.id}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">Poin: ${m.poin} | Transaksi: ${m.txCount}</div>
        </div>
        <button class="btn-hapus" onclick="confirmDeleteMember('${m.id}', '${m.nama}')">Hapus</button>
      </div>
    `).join('');

    const lastChild = el.lastElementChild;
    if (lastChild) lastChild.style.borderBottom = 'none';
  } catch (err) {
    console.error('Error rendering members:', err);
  }
}

// ===== ADMIN DASHBOARD EXTRA =====

async function loadAdminDashboardExtras() {
  try {
    // Force fresh data with timestamp
    const membersRes = await fetch('/api/admin/members?t=' + Date.now());
    const members = await membersRes.json();
    const bronze = members.filter(m => m.poin < 100).length;
    const silver = members.filter(m => m.poin >= 100 && m.poin < 300).length;
    const gold = members.filter(m => m.poin >= 300).length;

    document.getElementById('r-bz').textContent = bronze;
    document.getElementById('r-sv').textContent = silver;
    document.getElementById('r-gd').textContent = gold;

    // Load popular hadiah
    const txRes = await fetch('/api/admin/transactions?t=' + Date.now());
    const transactions = await txRes.json();
    const redeems = transactions.filter(t => t.tipe === 'redeem');
    const hadiahCount = {};
    redeems.forEach(t => {
      hadiahCount[t.ket] = (hadiahCount[t.ket] || 0) + 1;
    });
    const popular = Object.entries(hadiahCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
    document.getElementById('r-popular').innerHTML = popular.length > 0
      ? popular.map(([h, c]) => `<div class="rrow"><span>${h}</span><span class="rval">${c}x</span></div>`).join('')
      : '—';

    // Load employee activity
    const karyawanActivity = {};
    transactions.forEach(t => {
      if (t.kary) {
        karyawanActivity[t.kary] = (karyawanActivity[t.kary] || 0) + 1;
      }
    });
    const topKaryawan = Object.entries(karyawanActivity).sort((a, b) => b[1] - a[1]).slice(0, 3);
    document.getElementById('r-karyawan').innerHTML = topKaryawan.length > 0
      ? topKaryawan.map(([k, c]) => `<div class="rrow"><span>${k}</span><span class="rval">${c}</span></div>`).join('')
      : '—';
  } catch (err) {
    console.error('Error loading dashboard extras:', err);
  }
}
