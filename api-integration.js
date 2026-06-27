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
    const icons = ['🍩', '💸', '🎁', '⭐', '🎀'];

    el.innerHTML = hadiah.map((h, i) => {
      const color = colors[i % colors.length];
      const icon = icons[i % icons.length];
      return `<div class="hadiah-card ${color}">
        <div class="hadiah-judul">${icon} ${h.nama}</div>
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
    const icons = ['🍩', '💸', '🎁', '⭐', '🎀'];

    let html = '';
    hadiah.forEach((h, i) => {
      const cukup = memberPoin >= h.poin;
      const color = colors[i % colors.length];
      const icon = icons[i % icons.length];
      const className = cukup ? 'hadiah-card ' + color + ' clickable' : 'hadiah-card ' + color + ' disabled';

      html += `<div class="${className}" onclick="${cukup ? `prosesRedeem(${h.id}, '${memberId}')` : ''}">
        <div class="hadiah-judul">${icon} ${h.nama}</div>
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
        loadHadiahList();
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
