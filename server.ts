import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

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

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function databaseConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

async function supabaseRequest(pathname: string, options: RequestInit = {}) {
  if (!databaseConfigured()) throw new Error('Supabase is not configured');
  return fetch(`${supabaseUrl}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: supabaseKey!,
      Authorization: `Bearer ${supabaseKey!}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

app.get('/api/health', async (_req, res) => {
  try {
    if (!databaseConfigured()) {
      return res.json({ status: 'ok', database: false, provider: 'supabase' });
    }

    const response = await supabaseRequest('app_data?select=id&limit=1');
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    return res.json({ status: 'ok', database: true, provider: 'supabase' });
  } catch (error) {
    console.error('Database health check failed:', error);
    return res.status(503).json({ status: 'error', database: false, provider: 'supabase' });
  }
});

app.get('/api/db/:collection', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.has(collection)) return res.status(400).json({ error: 'Invalid collection' });
  if (!databaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured' });

  try {
    const response = await supabaseRequest(
      `app_data?collection=eq.${encodeURIComponent(collection)}&select=data&order=updated_at.asc`,
    );
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    const rows = await response.json();
    return res.json(rows.map((row: { data: unknown }) => row.data));
  } catch (error) {
    console.error(`Failed to read ${collection}:`, error);
    return res.status(500).json({ error: 'Failed to read data' });
  }
});

app.put('/api/db/:collection', async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS.has(collection)) return res.status(400).json({ error: 'Invalid collection' });
  if (!databaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured' });

  const items = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Request body must be an array' });
  if (items.some((item) => !item || typeof item.id !== 'string')) {
    return res.status(400).json({ error: 'Every item must contain a string id' });
  }

  try {
    // Replace only this collection. Other collections remain untouched.
    const deleteResponse = await supabaseRequest(
      `app_data?collection=eq.${encodeURIComponent(collection)}`,
      { method: 'DELETE' },
    );
    if (!deleteResponse.ok) throw new Error(`Delete returned ${deleteResponse.status}`);

    if (items.length > 0) {
      const rows = items.map((item) => ({
        collection,
        id: item.id,
        data: item,
      }));
      const insertResponse = await supabaseRequest('app_data', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(rows),
      });
      if (!insertResponse.ok) throw new Error(`Insert returned ${insertResponse.status}`);
    }

    return res.json({ ok: true, count: items.length });
  } catch (error) {
    console.error(`Failed to save ${collection}:`, error);
    return res.status(500).json({ error: 'Failed to save data' });
  }
});

app.delete('/api/db', async (_req, res) => {
  if (!databaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured' });

  try {
    const response = await supabaseRequest('app_data?id=not.is.null', { method: 'DELETE' });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to reset database:', error);
    return res.status(500).json({ error: 'Failed to reset data' });
  }
});

async function startServer() {
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
