import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Pool } from 'pg';

const currentDir = process.cwd();
const app = express();
app.use(express.json({ limit: '2mb' }));

const COLLECTIONS = new Set([
  'students',
  'tablets',
  'boxes',
  'assignments',
  'attendance',
  'auditLogs',
]);

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    })
  : null;

async function initDatabase() {
  if (!pool) {
    console.warn('DATABASE_URL is not configured. Production data persistence is disabled.');
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_data (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (collection, id)
    )
  `);
}

app.get('/api/health', async (_req, res) => {
  try {
    if (pool) await pool.query('SELECT 1');
    res.json({ status: 'ok', database: Boolean(pool) });
  } catch {
    res.status(503).json({ status: 'error', database: false });
  }
});

app.get('/api/db/:collection', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.has(collection)) return res.status(400).json({ error: 'Invalid collection' });
  if (!pool) return res.status(503).json({ error: 'Database is not configured' });

  try {
    const result = await pool.query(
      'SELECT data FROM app_data WHERE collection = $1 ORDER BY updated_at ASC',
      [collection],
    );
    res.json(result.rows.map((row) => row.data));
  } catch (error) {
    console.error(`Failed to read ${collection}:`, error);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

app.put('/api/db/:collection', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.has(collection)) return res.status(400).json({ error: 'Invalid collection' });
  if (!pool) return res.status(503).json({ error: 'Database is not configured' });

  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Request body must be an array' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM app_data WHERE collection = $1', [collection]);

    for (const item of items) {
      if (!item || typeof item.id !== 'string') {
        throw new Error('Every item must contain a string id');
      }
      await client.query(
        `INSERT INTO app_data (collection, id, data, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())`,
        [collection, item.id, JSON.stringify(item)],
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, count: items.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Failed to save ${collection}:`, error);
    res.status(500).json({ error: 'Failed to save data' });
  } finally {
    client.release();
  }
});

app.delete('/api/db', async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database is not configured' });
  try {
    await pool.query('TRUNCATE TABLE app_data');
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to reset database:', error);
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

async function startServer() {
  await initDatabase();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(currentDir, 'dist');
    app.get('/src/assets/images/school_management_logo_1785906402051.jpg', (_req, res) => {
      res.sendFile(path.join(distPath, 'favicon.svg'));
    });
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
