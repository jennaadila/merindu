const express = require('express');
const cors = require('cors');
const session = require('express-session');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== SQLite Database Setup =====
const db = new Database('membership.db');

// Enable foreign keys
db.pragma('foreign_keys = ON');

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
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      nama TEXT NOT NULL,
      pin TEXT NOT NULL,
      poin INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memberId TEXT NOT NULL,
      tgl DATE NOT NULL,
      waktu TIME,
      nominal INTEGER,
      poin INTEGER NOT NULL,
      tipe TEXT CHECK(tipe IN ('tambah', 'redeem')),
      ket TEXT,
      kary TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (memberId) REFERENCES members(id)
    );

    CREATE TABLE IF NOT EXISTS karyawan (
      username TEXT PRIMARY KEY,
      nama TEXT NOT NULL,
      password TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hadiah (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      desc TEXT,
      poin INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Initialize default settings if not exists
  const stmt = db.prepare('SELECT COUNT(*) as count FROM settings');
  const result = stmt.get();
  
  if (result.count === 0) {
    const insertStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertStmt.run('nominalPerPoin', '25000');
    insertStmt.run('silverThreshold', '100');
    insertStmt.run('goldThreshold', '300');
    insertStmt.run('adminPin', '1234');
  }

  // Initialize default hadiah if empty
  const hadiahCount = db.prepare('SELECT COUNT(*) as count FROM hadiah').get();
  if (hadiahCount.count === 0) {
    const insertHadiah = db.prepare('INSERT INTO hadiah (nama, desc, poin) VALUES (?, ?, ?)');
    insertHadiah.run('Donat Gratis', 'Tukar dengan 1 donat gratis pilihan', 20);
    insertHadiah.run('Setengah Lusin Donat', '6 donat dengan diskon khusus', 50);
    insertHadiah.run('Lusin Donat', '12 donat dengan harga spesial', 100);
  }

  // Initialize default karyawan if empty
  const karyCount = db.prepare('SELECT COUNT(*) as count FROM karyawan').get();
  if (karyCount.count === 0) {
    const insertKary = db.prepare('INSERT INTO karyawan (username, nama, password) VALUES (?, ?, ?)');
    insertKary.run('kasir01', 'Kasir 1', '123456');
    insertKary.run('kasir02', 'Kasir 2', '123456');
  }

  console.log('Database initialized successfully');
}

initDB();

// ===== MEMBER ROUTES =====

// Register
app.post('/api/register', (req, res) => {
  const { nama, hp, pin } = req.body;
  
  if (!nama || !hp || !pin || pin.length !== 4) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    const stmt = db.prepare('INSERT INTO members (id, nama, pin) VALUES (?, ?, ?)');
    stmt.run(hp, nama, pin);
    
    req.session.userId = hp;
    req.session.userType = 'member';
    req.session.userName = nama;
    
    res.json({ 
      success: true, 
      message: 'Registrasi berhasil',
      user: { id: hp, nama: nama }
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Nomor HP sudah terdaftar' });
    }
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Member Login
app.post('/api/member/login', (req, res) => {
  const { hp, pin } = req.body;
  
  if (!hp || !pin) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    const stmt = db.prepare('SELECT * FROM members WHERE id = ? AND pin = ?');
    const member = stmt.get(hp, pin);
    
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

// Get Member Profile
app.get('/api/member/profile', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'member') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const stmt = db.prepare('SELECT id, nama, poin FROM members WHERE id = ?');
    const member = stmt.get(req.session.userId);
    
    if (!member) {
      return res.status(404).json({ error: 'Member tidak ditemukan' });
    }

    res.json(member);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Get Member Transactions
app.get('/api/member/transactions', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'member') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const stmt = db.prepare(`
      SELECT id, tgl, waktu, nominal, poin, tipe, ket, kary 
      FROM transactions 
      WHERE memberId = ? 
      ORDER BY tgl DESC, waktu DESC
    `);
    const transactions = stmt.all(req.session.userId);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Member Logout
app.post('/api/member/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ===== KARYAWAN ROUTES =====

// Karyawan Login
app.post('/api/karyawan/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    const stmt = db.prepare('SELECT * FROM karyawan WHERE username = ? AND password = ?');
    const kary = stmt.get(username, password);
    
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

// Search Member (for karyawan)
app.get('/api/karyawan/search-member/:id', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'karyawan') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const stmt = db.prepare('SELECT id, nama, poin FROM members WHERE id = ?');
    const member = stmt.get(req.params.id);
    
    if (!member) {
      return res.status(404).json({ error: 'Member tidak ditemukan' });
    }

    res.json(member);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Add Transaction (for karyawan)
app.post('/api/karyawan/transaction', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'karyawan') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  const { memberId, tgl, nominal, poin } = req.body;
  
  if (!memberId || !tgl || nominal === undefined || poin === undefined) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    // Update member poin
    const updateStmt = db.prepare('UPDATE members SET poin = poin + ? WHERE id = ?');
    updateStmt.run(poin, memberId);

    // Insert transaction
    const insertStmt = db.prepare(`
      INSERT INTO transactions (memberId, tgl, waktu, nominal, poin, tipe, kary)
      VALUES (?, ?, ?, ?, ?, 'tambah', ?)
    `);
    const now = new Date();
    const waktu = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    insertStmt.run(memberId, tgl, waktu, nominal, poin, req.session.userName);

    res.json({ success: true, message: 'Transaksi disimpan' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Process Redeem (for karyawan)
app.post('/api/karyawan/redeem', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'karyawan') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  const { memberId, hadiahId } = req.body;
  
  if (!memberId || !hadiahId) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    // Get hadiah
    const hadiahStmt = db.prepare('SELECT * FROM hadiah WHERE id = ?');
    const hadiah = hadiahStmt.get(hadiahId);
    
    if (!hadiah) {
      return res.status(404).json({ error: 'Hadiah tidak ditemukan' });
    }

    // Check member poin
    const memberStmt = db.prepare('SELECT poin FROM members WHERE id = ?');
    const member = memberStmt.get(memberId);
    
    if (!member || member.poin < hadiah.poin) {
      return res.status(400).json({ error: 'Poin tidak cukup' });
    }

    // Update member poin
    const updateStmt = db.prepare('UPDATE members SET poin = poin - ? WHERE id = ?');
    updateStmt.run(hadiah.poin, memberId);

    // Insert transaction
    const insertStmt = db.prepare(`
      INSERT INTO transactions (memberId, tgl, waktu, poin, tipe, ket, kary)
      VALUES (?, ?, ?, ?, 'redeem', ?, ?)
    `);
    const now = new Date();
    const waktu = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const tgl = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    insertStmt.run(memberId, tgl, waktu, -hadiah.poin, hadiah.nama, req.session.userName);

    res.json({ success: true, message: 'Redeem berhasil' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Get All Members (for karyawan - redeem list)
app.get('/api/karyawan/members', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'karyawan') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const stmt = db.prepare('SELECT id, nama FROM members ORDER BY nama');
    const members = stmt.all();
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Get Karyawan Transactions (for history)
app.get('/api/karyawan/transactions', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'karyawan') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const stmt = db.prepare(`
      SELECT t.*, m.nama as memberNama
      FROM transactions t
      JOIN members m ON t.memberId = m.id
      WHERE t.kary = ?
      ORDER BY t.tgl DESC, t.waktu DESC
    `);
    const transactions = stmt.all(req.session.userName);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Karyawan Logout
app.post('/api/karyawan/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ===== ADMIN ROUTES =====

// Admin Login (PIN verification)
app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body;
  
  if (!pin) {
    return res.status(400).json({ error: 'PIN tidak valid' });
  }

  try {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get('adminPin');
    
    if (!result || result.value !== pin) {
      return res.status(401).json({ error: 'PIN salah' });
    }

    req.session.userId = 'admin';
    req.session.userType = 'admin';
    
    res.json({ success: true, message: 'Login berhasil' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Get Admin Dashboard Data
app.get('/api/admin/dashboard', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'admin') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const members = db.prepare('SELECT COUNT(*) as count FROM members').get();
    const tambah = db.prepare(`SELECT COUNT(*) as count FROM transactions WHERE tipe = 'tambah'`).get();
    const redeem = db.prepare(`SELECT COUNT(*) as count FROM transactions WHERE tipe = 'redeem'`).get();
    const omset = db.prepare(`SELECT SUM(nominal) as total FROM transactions WHERE tipe = 'tambah'`).get();
    const poinBeredar = db.prepare(`SELECT SUM(poin) as total FROM members`).get();
    const poinKeluar = db.prepare(`SELECT SUM(ABS(poin)) as total FROM transactions WHERE tipe = 'redeem'`).get();

    res.json({
      totalMembers: members.count,
      totalTransactions: tambah.count,
      totalRedeem: redeem.count,
      omset: omset.total || 0,
      poinBeredar: poinBeredar.total || 0,
      poinKeluar: poinKeluar.total || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Get All Members (for admin)
app.get('/api/admin/members', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'admin') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const stmt = db.prepare(`
      SELECT m.id, m.nama, m.poin, 
             COUNT(t.id) as txCount,
             m.createdAt
      FROM members m
      LEFT JOIN transactions t ON m.id = t.memberId
      GROUP BY m.id
      ORDER BY m.nama
    `);
    const members = stmt.all();
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Delete Member (admin only)
app.delete('/api/admin/members/:id', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'admin') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  const memberId = req.params.id;

  try {
    // Check if member exists
    const memberStmt = db.prepare('SELECT * FROM members WHERE id = ?');
    const member = memberStmt.get(memberId);
    
    if (!member) {
      return res.status(404).json({ error: 'Member tidak ditemukan' });
    }

    // Delete all transactions for this member
    const deleteTransStmt = db.prepare('DELETE FROM transactions WHERE memberId = ?');
    deleteTransStmt.run(memberId);

    // Delete the member
    const deleteMemberStmt = db.prepare('DELETE FROM members WHERE id = ?');
    deleteMemberStmt.run(memberId);

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

// Get All Hadiah
app.get('/api/hadiah', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM hadiah ORDER BY poin');
    const hadiah = stmt.all();
    res.json(hadiah);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Add Hadiah (admin)
app.post('/api/admin/hadiah', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'admin') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  const { nama, desc, poin } = req.body;
  
  if (!nama || !poin || poin <= 0) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    const stmt = db.prepare('INSERT INTO hadiah (nama, desc, poin) VALUES (?, ?, ?)');
    stmt.run(nama, desc || '', poin);
    res.json({ success: true, message: 'Hadiah ditambahkan' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Edit Hadiah (admin)
app.put('/api/admin/hadiah/:id', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'admin') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  const { nama, desc, poin } = req.body;
  
  if (!nama || !poin || poin <= 0) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    const stmt = db.prepare('UPDATE hadiah SET nama = ?, desc = ?, poin = ? WHERE id = ?');
    stmt.run(nama, desc || '', poin, req.params.id);
    res.json({ success: true, message: 'Hadiah diperbarui' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Delete Hadiah (admin)
app.delete('/api/admin/hadiah/:id', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'admin') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  try {
    const stmt = db.prepare('DELETE FROM hadiah WHERE id = ?');
    stmt.run(req.params.id);
    res.json({ success: true, message: 'Hadiah dihapus' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Get Settings
app.get('/api/settings', (req, res) => {
  try {
    const stmt = db.prepare('SELECT key, value FROM settings');
    const settings = stmt.all();
    const result = {};
    settings.forEach(s => {
      result[s.key] = isNaN(s.value) ? s.value : parseInt(s.value);
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Update Settings (admin)
app.post('/api/admin/settings', (req, res) => {
  if (!req.session.userId || req.session.userType !== 'admin') {
    return res.status(401).json({ error: 'Tidak login' });
  }

  const { key, value } = req.body;
  
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'Data tidak valid' });
  }

  try {
    const stmt = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
    stmt.run(String(value), key);
    res.json({ success: true, message: 'Setting disimpan' });
  } catch (err) {
    res.status(500).json({ error: 'Terjadi kesalahan' });
  }
});

// Check Session
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

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Merindu Donat Membership running on http://localhost:${PORT}`);
});
