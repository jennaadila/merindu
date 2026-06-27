const express = require('express');
const cors = require('cors');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== PostgreSQL Database Setup =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'merindu-membership-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// ===== Initialize Database =====
async function initDB() {
  try {
    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        nama TEXT NOT NULL,
        pin TEXT NOT NULL,
        poin INTEGER DEFAULT 0,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        memberId TEXT NOT NULL REFERENCES members(id),
        tgl DATE NOT NULL,
        waktu TIME,
        nominal INTEGER,
        poin INTEGER NOT NULL,
        tipe TEXT CHECK(tipe IN ('tambah', 'redeem')),
        ket TEXT,
        kary TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS karyawan (
        username TEXT PRIMARY KEY,
        nama TEXT NOT NULL,
        password TEXT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS hadiah (
        id SERIAL PRIMARY KEY,
        nama TEXT NOT NULL,
        "desc" TEXT,
        poin INTEGER NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Initialize default settings
    const settingsCount = await pool.query('SELECT COUNT(*) FROM settings');
    if (parseInt(settingsCount.rows[0].count) === 0) {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', ['nominalPerPoin', '25000']);
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', ['silverThreshold', '100']);
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', ['goldThreshold', '300']);
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', ['adminPin', '1234']);
    }

    // Initialize default hadiah
    const hadiahCount = await pool.query('SELECT COUNT(*) FROM hadiah');
    if (parseInt(hadiahCount.rows[0].count) === 0) {
      await pool.query('INSERT INTO hadiah (nama, "desc", poin) VALUES ($1, $2, $3)', ['Donat Gratis', 'Tukar dengan 1 donat gratis pilihan', 20]);
      await pool.query('INSERT INTO hadiah (nama, "desc", poin) VALUES ($1, $2, $3)', ['Setengah Lusin Donat', '6 donat dengan diskon khusus', 50]);
      await pool.query('INSERT INTO hadiah (nama, "desc", poin) VALUES ($1, $2, $3)', ['Lusin Donat', '12 donat dengan harga spesial', 100]);
    }

    // Initialize default karyawan
    const karyCount = await pool.query('SELECT COUNT(*) FROM karyawan');
    if (parseInt(karyCount.rows[0].count) === 0) {
      await pool.query('INSERT INTO karyawan (username, nama, password) VALUES ($1, $2, $3)', ['kasir01', 'Kasir 1', '123456']);
      await pool.query('INSERT INTO karyawan (username, nama, password) VALUES ($1, $2, $3)', ['kasir02', 'Kasir 2', '123456']);
    }

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

initDB();

// ===== MEMBER ROUTES =====

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/debug/members', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nama FROM members LIMIT 10');
    res.json({ 
      count: result.rows.length, 
      members: result.rows 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/register', async (req, res) => {
  const { nama, hp, pin } = req.body;
  
  if (!nama || !hp || !pin || pin.length !== 4) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    await pool.query('INSERT INTO members (id, nama, pin) VALUES ($1, $2, $3)', [hp, nama, pin]);
    
    req.session.userId = hp;
    req.session.userType = 'member';
    req.session.userName = nama;
    
    res.json({ 
      success: true, 
      message: 'Registrasi berhasil',
      user: { id: hp, nama: nama }
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Nomor HP sudah terdaftar' });
    }
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.post('/api/member/login', async (req, res) => {
  const { hp, pin } = req.body;
  
  if (!hp || !pin) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    const result = await pool.query('SELECT * FROM members WHERE id = $1 AND pin = $2', [hp, pin]);
    const member = result.rows[0];
    
    if (!member) {
      return res.status(401).json({ error: 'Nomor HP atau PIN salah' });
    }

    req.session.userId = hp;
    req.session.userType = 'member';
    req.session.userName = member.nama;
    
    res.json({ 
      success: true, 
      message: 'Login berhasil',
      user: { id: hp, nama: member.nama, poin: member.poin }
    });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.get('/api/member/profile', async (req, res) => {
  if (!req.session.userId || req.session.userType !== 'member') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const result = await pool.query('SELECT id, nama, poin FROM members WHERE id = $1', [req.session.userId]);
    const member = result.rows[0];
    
    if (!member) {
      return res.status(404).json({ error: 'Member tidak ditemukan' });
    }

    res.json(member);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.get('/api/member/transactions', async (req, res) => {
  if (!req.session.userId || req.session.userType !== 'member') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const result = await pool.query(`
      SELECT id, tgl, waktu, nominal, poin, tipe, ket, kary 
      FROM transactions 
      WHERE memberId = $1 
      ORDER BY tgl DESC, waktu DESC
    `, [req.session.userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.post('/api/member/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ===== KARYAWAN ROUTES =====

app.post('/api/karyawan/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    const result = await pool.query('SELECT * FROM karyawan WHERE username = $1 AND password = $2', [username, password]);
    const kary = result.rows[0];
    
    if (!kary) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }

    req.session.userId = username;
    req.session.userType = 'karyawan';
    req.session.userName = kary.nama;
    
    res.json({ 
      success: true, 
      message: 'Login berhasil',
      user: { id: username, nama: kary.nama }
    });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.get('/api/karyawan/search-member/:id', async (req, res) => {
  if (!req.session.userId || req.session.userType !== 'karyawan') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const result = await pool.query('SELECT id, nama, poin FROM members WHERE id = $1', [req.params.id]);
    const member = result.rows[0];
    
    if (!member) {
      return res.status(404).json({ error: 'Member tidak ditemukan' });
    }

    res.json(member);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.post('/api/karyawan/transaction', async (req, res) => {
  if (!req.session.userId || req.session.userType !== 'karyawan') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  const { memberId, tgl, nominal, poin } = req.body;
  
  if (!memberId || !tgl || nominal === undefined || poin === undefined) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    await pool.query('UPDATE members SET poin = poin + $1 WHERE id = $2', [poin, memberId]);

    const now = new Date();
    const waktu = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    await pool.query(`
      INSERT INTO transactions (memberId, tgl, waktu, nominal, poin, tipe, kary)
      VALUES ($1, $2, $3, $4, $5, 'tambah', $6)
    `, [memberId, tgl, waktu, nominal, poin, req.session.userName]);

    res.json({ success: true, message: 'Transaksi disimpan' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.post('/api/karyawan/redeem', async (req, res) => {
  if (!req.session.userId || req.session.userType !== 'karyawan') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  const { memberId, hadiahId } = req.body;
  
  if (!memberId || !hadiahId) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    const hadiahResult = await pool.query('SELECT * FROM hadiah WHERE id = $1', [hadiahId]);
    const hadiah = hadiahResult.rows[0];
    
    if (!hadiah) {
      return res.status(404).json({ error: 'Hadiah tidak ditemukan' });
    }

    const memberResult = await pool.query('SELECT poin FROM members WHERE id = $1', [memberId]);
    const member = memberResult.rows[0];
    
    if (!member || member.poin < hadiah.poin) {
      return res.status(400).json({ error: 'Poin tidak cukup' });
    }

    await pool.query('UPDATE members SET poin = poin - $1 WHERE id = $2', [hadiah.poin, memberId]);

    const now = new Date();
    const waktu = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const tgl = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    await pool.query(`
      INSERT INTO transactions (memberId, tgl, waktu, poin, tipe, ket, kary)
      VALUES ($1, $2, $3, $4, 'redeem', $5, $6)
    `, [memberId, tgl, waktu, -hadiah.poin, hadiah.nama, req.session.userName]);

    res.json({ success: true, message: 'Redeem berhasil' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.get('/api/karyawan/members', async (req, res) => {
  if (!req.session.userId || req.session.userType !== 'karyawan') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const result = await pool.query('SELECT id, nama FROM members ORDER BY nama');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.get('/api/karyawan/transactions', async (req, res) => {
  if (!req.session.userId || req.session.userType !== 'karyawan') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const result = await pool.query(`
      SELECT t.*, m.nama as memberNama
      FROM transactions t
      JOIN members m ON t.memberId = m.id
      WHERE t.kary = $1
      ORDER BY t.tgl DESC, t.waktu DESC
    `, [req.session.userName]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.post('/api/karyawan/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ===== ADMIN ROUTES =====

app.post('/api/admin/login', async (req, res) => {
  const { pin } = req.body;
  
  if (!pin) {
    return res.status(400).json({ error: 'PIN tidak valid' });
  }

  try {
    const result = await pool.query('SELECT value FROM settings WHERE key = $1', ['adminPin']);
    
    if (!result.rows[0] || result.rows[0].value !== pin) {
      return res.status(401).json({ error: 'PIN salah' });
    }

    req.session.userId = 'admin';
    req.session.userType = 'admin';
    
    res.json({ success: true, message: 'Login berhasil' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.get('/api/admin/dashboard', async (req, res) => {
  if (!req.session.userId || req.session.userType !== 'admin') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const members = await pool.query('SELECT COUNT(*) as count FROM members');
    const tambah = await pool.query(`SELECT COUNT(*) as count FROM transactions WHERE tipe = 'tambah'`);
    const redeem = await pool.query(`SELECT COUNT(*) as count FROM transactions WHERE tipe = 'redeem'`);
    const omset = await pool.query(`SELECT SUM(nominal) as total FROM transactions WHERE tipe = 'tambah'`);
    const poinBeredar = await pool.query(`SELECT SUM(poin) as total FROM members`);
    const poinKeluar = await pool.query(`SELECT SUM(ABS(poin)) as total FROM transactions WHERE tipe = 'redeem'`);

    res.json({
      totalMembers: parseInt(members.rows[0].count),
      totalTransactions: parseInt(tambah.rows[0].count),
      totalRedeem: parseInt(redeem.rows[0].count),
      omset: omset.rows[0].total || 0,
      poinBeredar: poinBeredar.rows[0].total || 0,
      poinKeluar: poinKeluar.rows[0].total || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.get('/api/admin/members', async (req, res) => {
  if (!req.session.userId || req.session.userType !== 'admin') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const result = await pool.query(`
      SELECT m.id, m.nama, m.poin, 
             COUNT(t.id)::int as txCount,
             m.createdAt
      FROM members m
      LEFT JOIN transactions t ON m.id = t.memberId
      GROUP BY m.id
      ORDER BY m.nama
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.delete('/api/admin/members/:id', async (req, res) => {
  if (!req.session.userId || req.session.userType !== 'admin') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  const memberId = req.params.id;

  try {
    const memberResult = await pool.query('SELECT * FROM members WHERE id = $1', [memberId]);
    const member = memberResult.rows[0];
    
    if (!member) {
      return res.status(404).json({ error: 'Member tidak ditemukan' });
    }

    await pool.query('DELETE FROM transactions WHERE memberId = $1', [memberId]);
    await pool.query('DELETE FROM members WHERE id = $1', [memberId]);

    res.json({ 
      success: true, 
      message: 'Member ' + member.nama + ' berhasil dihapus',
      deletedMember: member
    });
  } catch (err) {
    console.error('Delete member error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.get('/api/hadiah', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hadiah ORDER BY poin');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.post('/api/admin/hadiah', async (req, res) => {
  if (!req.session.userId || req.session.userType !== 'admin') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  const { nama, desc, poin } = req.body;
  
  if (!nama || !poin || poin <= 0) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    await pool.query('INSERT INTO hadiah (nama, "desc", poin) VALUES ($1, $2, $3)', [nama, desc || '', poin]);
    res.json({ success: true, message: 'Hadiah ditambahkan' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.put('/api/admin/hadiah/:id', async (req, res) => {
  if (!req.session.userId || req.session.userType !== 'admin') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  const { nama, desc, poin } = req.body;
  
  if (!nama || !poin || poin <= 0) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    await pool.query('UPDATE hadiah SET nama = $1, "desc" = $2, poin = $3 WHERE id = $4', [nama, desc || '', poin, req.params.id]);
    res.json({ success: true, message: 'Hadiah diperbarui' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.delete('/api/admin/hadiah/:id', async (req, res) => {
  if (!req.session.userId || req.session.userType !== 'admin') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    await pool.query('DELETE FROM hadiah WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Hadiah dihapus' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(s => {
      settings[s.key] = isNaN(s.value) ? s.value : parseInt(s.value);
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.post('/api/admin/settings', async (req, res) => {
  if (!req.session.userId || req.session.userType !== 'admin') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  const { key, value } = req.body;
  
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    await pool.query('UPDATE settings SET value = $1 WHERE key = $2', [String(value), key]);
    res.json({ success: true, message: 'Setting disimpan' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

app.get('/api/session', (req, res) => {
  if (req.session.userId) {
    res.json({
      logged: true,
      userId: req.session.userId,
      userType: req.session.userType,
      userName: req.session.userName
    });
  } else {
    res.json({ logged: false });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`Merindu Donat Membership running on port ${PORT}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Connected' : 'NOT SET'}`);
  console.log(`========================================`);
});
