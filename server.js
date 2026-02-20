const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-change-me';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));   // Serve all HTML files

// Auth Middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, role: user.role, username });
});

// Seed demo data
app.post('/api/seed', authenticate, async (req, res) => {
  // Insert sample apartments, owners, etc. (full insert omitted for brevity - add your own)
  res.json({ message: 'Sample data seeded' });
});

// Generic CRUD helpers
const crudRoutes = (table) => {
  app.get(`/api/${table}`, authenticate, async (req, res) => {
    const result = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
    res.json(result.rows);
  });

  app.post(`/api/${table}`, authenticate, async (req, res) => {
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    const placeholders = keys.map((_, i) => `$${i+1}`).join(',');
    const result = await pool.query(
      `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  });

  app.put(`/api/${table}/:id`, authenticate, async (req, res) => {
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);
    const set = keys.map((k, i) => `${k}=$${i+1}`).join(',');
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE ${table} SET ${set} WHERE id = $${values.length} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  });

  app.delete(`/api/${table}/:id`, authenticate, async (req, res) => {
    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  });
};

// Apply CRUD to all modules
['apartments', 'owners', 'tenants', 'maintenance_payments', 'transactions'].forEach(crudRoutes);

// Bulk import transactions
app.post('/api/transactions/bulk', authenticate, async (req, res) => {
  const { rows } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      await client.query(
        'INSERT INTO transactions (date, description, amount, type, category) VALUES ($1, $2, $3, $4, $5)',
        [row.date, row.description, row.amount, row.type, 'Bank Import']
      );
    }
    await client.query('COMMIT');
    res.json({ imported: rows.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Reports endpoints (for complex ones)
app.get('/api/reports/balance-sheet', authenticate, async (req, res) => {
  const tx = await pool.query('SELECT type, SUM(amount) as total FROM transactions GROUP BY type');
  const maint = await pool.query('SELECT SUM(amount_due - amount_paid) as receivable FROM maintenance_payments WHERE status = \'pending\'');
  const bank = (tx.rows.find(r => r.type === 'credit')?.total || 0) - (tx.rows.find(r => r.type === 'debit')?.total || 0);
  res.json({
    assets: { bankBalance: bank, maintenanceReceivable: maint.rows[0].receivable || 0 },
    totalAssets: bank + (maint.rows[0].receivable || 0)
  });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));