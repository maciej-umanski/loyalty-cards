import express from 'express';
import { promises as fs } from 'node:fs';
import { existsSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'cards.json');
const STATIC_DIR = path.join(__dirname, 'dist');

let cards = [];
let writeQueue = Promise.resolve();

async function loadCards() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    cards = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') {
      cards = [];
      await persistCards();
    } else {
      console.error('Failed to load cards.json:', err);
      cards = [];
    }
  }
}

async function persistCards() {
  writeQueue = writeQueue.then(async () => {
    const tmp = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(cards, null, 2), 'utf8');
    renameSync(tmp, DATA_FILE);
  });
  return writeQueue;
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/cards', (req, res) => {
  res.json(cards);
});

app.post('/api/cards', async (req, res) => {
  const { name, barcode, format, color, notes } = req.body || {};
  const value = String(barcode ?? '').trim();
  const cardName = String(name ?? '').trim();

  if (!cardName) return res.status(400).json({ error: 'Card name is required' });
  if (!value) return res.status(400).json({ error: 'Barcode value is required' });

  const card = {
    id: crypto.randomUUID(),
    name: cardName,
    barcode: value,
    format: typeof format === 'string' && format ? format : 'CODE_128',
    color: typeof color === 'string' && color ? color : '#6366f1',
    notes: typeof notes === 'string' ? notes : '',
    createdAt: new Date().toISOString()
  };

  cards.push(card);
  await persistCards();
  res.status(201).json(card);
});

app.put('/api/cards/:id', async (req, res) => {
  const idx = cards.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Card not found' });

  const { name, barcode, format, color, notes } = req.body || {};
  if (name !== undefined && String(name).trim()) cards[idx].name = String(name).trim();
  if (barcode !== undefined && String(barcode).trim()) cards[idx].barcode = String(barcode).trim();
  if (format !== undefined && typeof format === 'string' && format) cards[idx].format = format;
  if (color !== undefined && typeof color === 'string' && color) cards[idx].color = color;
  if (notes !== undefined) cards[idx].notes = typeof notes === 'string' ? notes : '';

  await persistCards();
  res.json(cards[idx]);
});

app.delete('/api/cards/:id', async (req, res) => {
  const idx = cards.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Card not found' });
  cards.splice(idx, 1);
  await persistCards();
  res.status(204).end();
});

if (existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR, { maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.type('text').send('Static build not found. Run `npm run build` first.');
  });
}

await loadCards();
app.listen(PORT, () => {
  console.log(`Loyalty Cards listening on http://0.0.0.0:${PORT}`);
});
