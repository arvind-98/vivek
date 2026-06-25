const express = require('express');
const initSqlJs = require('sql.js');
const path = require('path');
const fss = require('fs');

const DB_FILE = path.join(__dirname, 'data.db');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fss.existsSync(DB_FILE)) {
    db = new SQL.Database(fss.readFileSync(DB_FILE));
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT    NOT NULL,
      email TEXT    NOT NULL,
      phone TEXT    NOT NULL
    )
  `);
  saveDB();
}

function saveDB() {
  fss.writeFileSync(DB_FILE, Buffer.from(db.export()));
}

function getAll() {
  const stmt = db.prepare('SELECT * FROM contacts ORDER BY id DESC');
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function getById(id) {
  const stmt = db.prepare('SELECT * FROM contacts WHERE id = ?');
  stmt.bind([id]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

// GET all
app.get('/api/contacts', (req, res) => {
  res.json(getAll());
});

// GET single
app.get('/api/contacts/:id', (req, res) => {
  const row = getById(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// POST create
app.post('/api/contacts', (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'name, email and phone are required' });
  }
  db.run('INSERT INTO contacts (name, email, phone) VALUES (?, ?, ?)', [name, email, phone]);
  saveDB();
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  res.status(201).json({ id, name, email, phone });
});

// PUT update
app.put('/api/contacts/:id', (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'name, email and phone are required' });
  }
  const id = Number(req.params.id);
  if (!getById(id)) return res.status(404).json({ error: 'Not found' });
  db.run('UPDATE contacts SET name = ?, email = ?, phone = ? WHERE id = ?', [name, email, phone, id]);
  saveDB();
  res.json({ id, name, email, phone });
});

// DELETE
app.delete('/api/contacts/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getById(id)) return res.status(404).json({ error: 'Not found' });
  db.run('DELETE FROM contacts WHERE id = ?', [id]);
  saveDB();
  res.json({ message: 'Deleted' });
});

const PORT = 3000;
initDB().then(() => {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
});
