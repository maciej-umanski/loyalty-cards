import './styles.css';
import { listCards, createCard, updateCard, deleteCard } from './api.js';
import { startScanner, renderBarcode, supportsCamera, isSecureContext } from './barcode.js';

const app = document.getElementById('app');
const addBtn = document.getElementById('add-btn');
const toastEl = document.getElementById('toast');

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#000000', '#ffffff'];

let cards = [];
let editingId = null;
let toastTimer = null;
let activeStopCamera = null;
let activeFolder = null;
let searchQuery = '';
let homeGridEl = null;
let folderBarEl = null;

const UNFILED = '\u0000unfiled';

const h = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function openAdd() {
  editingId = null;
  app.replaceChildren(buildForm());
  addBtn.style.display = 'none';
}

function openEdit(id) {
  const card = cards.find((c) => c.id === id);
  if (!card) return;
  editingId = id;
  app.replaceChildren(buildForm(card));
  addBtn.style.display = 'none';
}

function backHome() {
  if (activeStopCamera) activeStopCamera();
  activeStopCamera = null;
  editingId = null;
  app.replaceChildren(buildHome());
  addBtn.style.display = '';
}

function escapeKey(e) {
  if (e.key === 'Escape') backHome();
}
document.addEventListener('keydown', escapeKey);

async function loadCards() {
  try {
    cards = await listCards();
  } catch (err) {
    cards = [];
    toast('Could not load cards: ' + err.message);
  }
  renderHome();
}

/* ---------------- Home ---------------- */

function buildHome() {
  activeFolder = null;
  searchQuery = '';

  const root = document.createElement('div');
  root.className = 'home';

  const searchBox = h('div', 'search');
  const searchInput = h('input', 'search__input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Search cards\u2026';
  searchInput.autocomplete = 'off';
  searchInput.value = searchQuery;
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderGrid();
    renderFolderBar();
  });
  searchBox.appendChild(searchInput);
  root.appendChild(searchBox);

  folderBarEl = h('div', 'folder-bar');
  root.appendChild(folderBarEl);
  renderFolderBar();

  homeGridEl = h('div', 'cards-grid');
  root.appendChild(homeGridEl);
  renderGrid();

  return root;
}

function collectFolders() {
  const map = new Map();
  cards.forEach((c) => {
    const f = (c.folder || '').trim();
    map.set(f, (map.get(f) || 0) + 1);
  });
  return [...map.entries()];
}

function renderFolderBar() {
  if (!folderBarEl) return;
  folderBarEl.replaceChildren();

  const chip = (label, value, count) => {
    const c = h('button', 'folder-chip' + (activeFolder === value ? ' selected' : ''), label);
    c.dataset.folder = value === null ? 'all' : value === UNFILED ? 'unfiled' : value;
    if (count !== undefined) c.appendChild(h('span', 'folder-chip__count', String(count)));
    c.addEventListener('click', () => {
      activeFolder = value;
      renderFolderBar();
      renderGrid();
    });
    return c;
  };

  folderBarEl.appendChild(chip('All', null, cards.length));
  const unfiled = collectFolders().find(([f]) => f === '')?.[1];
  if (unfiled) folderBarEl.appendChild(chip('Unfiled', UNFILED, unfiled));
  collectFolders().forEach(([f, n]) => {
    if (f !== '') folderBarEl.appendChild(chip(f, f, n));
  });
}

function filteredCards() {
  const q = searchQuery.trim().toLowerCase();
  return cards.filter((c) => {
    const folder = (c.folder || '').trim();
    if (activeFolder === UNFILED && folder !== '') return false;
    if (activeFolder && activeFolder !== UNFILED && folder !== activeFolder) return false;
    if (!q) return true;
    return `${c.name} ${c.barcode} ${c.notes || ''} ${folder}`.toLowerCase().includes(q);
  });
}

function renderGrid() {
  if (!homeGridEl) return;
  const filtered = filteredCards();
  homeGridEl.replaceChildren();

  if (filtered.length === 0) {
    const empty = h('div', 'empty');
    if (cards.length === 0) {
      empty.appendChild(h('div', 'empty-icon', '\uD83D\uDCB3'));
      empty.appendChild(h('p', '', 'No cards yet.'));
      empty.appendChild(h('p', '', 'Tap "Add card" to scan or enter a loyalty card.'));
    } else {
      empty.appendChild(h('div', 'empty-icon', '\uD83D\uDCF0'));
      empty.appendChild(h('p', '', 'No matching cards.'));
    }
    homeGridEl.appendChild(empty);
    return;
  }

  filtered.forEach((card) => homeGridEl.appendChild(buildTile(card)));
}

function buildTile(card) {
  const tile = h('button', 'card-tile');
  tile.style.setProperty('--accent', card.color);
  tile.addEventListener('click', () => openDetail(card.id));

  const body = h('div', 'card-tile__body');
  body.appendChild(h('div', 'card-tile__name', card.name));
  body.appendChild(h('div', 'card-tile__num', card.barcode));

  tile.appendChild(body);
  return tile;
}

function renderHome() {
  app.replaceChildren(buildHome());
}

/* ---------------- Detail ---------------- */

function openDetail(id) {
  const card = cards.find((c) => c.id === id);
  if (!card) return;
  addBtn.style.display = 'none';

  const detail = h('div', 'detail');
  const head = h('div', 'detail__head');
  const back = h('button', 'btn btn-ghost', '\u2190 Back');
  back.addEventListener('click', () => {
    backHome();
  });
  head.appendChild(back);
  const title = h('h2', 'detail__title', card.name);
  if (card.color && card.color !== '#000000') title.style.color = card.color;
  head.appendChild(title);
  detail.appendChild(head);

  const barcodeBox = h('div', 'detail__barcode');
  renderBarcode(barcodeBox, card, { height: 140 });
  detail.appendChild(barcodeBox);
  detail.appendChild(h('div', 'detail__num', card.barcode));

  if (card.notes) detail.appendChild(h('p', 'detail__notes', card.notes));

  const actions = h('div', 'detail__actions');
  const edit = h('button', 'btn', 'Edit');
  edit.addEventListener('click', () => openEdit(card.id));
  const del = h('button', 'btn btn-danger', 'Delete');
  del.addEventListener('click', () => confirmDelete(card));
  actions.appendChild(edit);
  actions.appendChild(del);
  detail.appendChild(actions);

  app.replaceChildren(detail);
}

async function confirmDelete(card) {
  if (!confirm(`Delete "${card.name}"?`)) return;
  try {
    await deleteCard(card.id);
    cards = cards.filter((c) => c.id !== card.id);
    toast('Card deleted');
    backHome();
  } catch (err) {
    toast('Delete failed: ' + err.message);
  }
}

/* ---------------- Add / Edit form ---------------- */

function buildForm(card = {}) {
  const name = card.name || '';
  const value = card.barcode || '';
  const format = card.format || 'CODE_128';
  const color = card.color || COLORS[0];
  const notes = card.notes || '';

  let currentFormat = format;

  const form = h('div', 'form');
  const title = h('h2', 'form__title', card.name ? 'Edit card' : 'Add card');
  form.appendChild(title);

  const scannerSection = h('div', 'scanner');
  const viewport = h('div', 'scanner__viewport');
  const video = h('video', 'scanner__video');
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('autoplay', '');
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  const placeholder = h('div', 'scanner__placeholder', '\uD83D\uDCF7 Camera preview');
  const frame = h('div', 'scanner__frame');
  [
    ['tl', 'top', 'left'],
    ['tr', 'top', 'right'],
    ['bl', 'bottom', 'left'],
    ['br', 'bottom', 'right']
  ].forEach(([corner]) => {
    frame.appendChild(h('div', `frame-corner ${corner}`));
  });
  frame.appendChild(h('div', 'scanline'));
  frame.hidden = true;
  viewport.appendChild(video);
  viewport.appendChild(placeholder);
  viewport.appendChild(frame);

  const scanStatus = h('p', 'scanner__status');
  scannerSection.appendChild(viewport);
  scannerSection.appendChild(scanStatus);
  form.appendChild(scannerSection);

  const scanBox = h('div', 'form__field');
  scanBox.appendChild(h('label', 'form__label', 'Barcode number'));
  const scanInput = h('input', 'form__input');
  scanInput.type = 'text';
  scanInput.placeholder = 'Barcode number';
  scanInput.value = value;
  scanInput.autocomplete = 'off';
  scanBox.appendChild(scanInput);
  form.appendChild(scanBox);

  const modeBtn = h('button', 'btn btn-ghost', '');
  form.appendChild(modeBtn);

  const field = (labelText, input) => {
    const box = h('div', 'form__field');
    box.appendChild(h('label', 'form__label', labelText));
    box.appendChild(input);
    return box;
  };

  const nameInput = h('input', 'form__input');
  nameInput.type = 'text';
  nameInput.placeholder = 'e.g. My Supermarket';
  nameInput.value = name;
  nameInput.autocomplete = 'off';
  nameInput.required = true;
  form.appendChild(field('Card name', nameInput));

  const colorBox = h('div', 'form__field');
  colorBox.appendChild(h('label', 'form__label', 'Color'));
  const swatches = h('div', 'swatches');
  COLORS.forEach((c) => {
    const s = h('button', 'swatch' + (c === color ? ' selected' : ''));
    s.type = 'button';
    s.dataset.color = c;
    s.style.background = c;
    s.addEventListener('click', () => {
      swatches.querySelectorAll('.swatch').forEach((x) => x.classList.remove('selected'));
      s.classList.add('selected');
      colorInput.value = c;
    });
    swatches.appendChild(s);
  });
  const colorInput = h('input', 'form__color-input');
  colorInput.type = 'hidden';
  colorInput.value = color;
  colorBox.appendChild(swatches);
  colorBox.appendChild(colorInput);
  form.appendChild(colorBox);

  const folderBox = h('div', 'form__field');
  folderBox.appendChild(h('label', 'form__label', 'Folder'));
  const folderSelect = h('select', 'form__input form__select');
  const mkOption = (v, label) => {
    const o = h('option', '', label);
    o.value = v;
    return o;
  };
  folderSelect.appendChild(mkOption('', 'No folder'));
  const existingFolders = [...new Set(cards.map((c) => (c.folder || '').trim()).filter(Boolean))];
  existingFolders.forEach((f) => folderSelect.appendChild(mkOption(f, f)));
  folderSelect.appendChild(mkOption('__new', 'New folder\u2026'));
  const currentFolder = (card.folder || '').trim();
  folderSelect.value = currentFolder && existingFolders.includes(currentFolder) ? currentFolder : '';
  const newFolderInput = h('input', 'form__input');
  newFolderInput.type = 'text';
  newFolderInput.placeholder = 'Folder name';
  newFolderInput.maxLength = 50;
  newFolderInput.hidden = true;
  folderSelect.addEventListener('change', () => {
    const isNew = folderSelect.value === '__new';
    newFolderInput.hidden = !isNew;
    if (!isNew) newFolderInput.value = '';
  });
  folderBox.appendChild(folderSelect);
  folderBox.appendChild(newFolderInput);
  form.appendChild(folderBox);

  const notesInput = h('textarea', 'form__input form__textarea');
  notesInput.placeholder = 'Notes (optional)';
  notesInput.rows = 2;
  notesInput.value = notes;
  form.appendChild(field('Notes', notesInput));

  const actions = h('div', 'form__actions');
  const cancel = h('button', 'btn btn-ghost', 'Cancel');
  cancel.addEventListener('click', () => {
    stopCamera();
    backHome();
  });
  const save = h('button', 'btn btn-primary', 'Save');
  save.addEventListener('click', async () => {
    const data = {
      name: nameInput.value.trim(),
      barcode: scanInput.value.trim(),
      format: currentFormat,
      color: colorInput.value,
      folder: folderSelect.value === '__new' ? newFolderInput.value.trim() : folderSelect.value,
      notes: notesInput.value.trim()
    };
    if (!data.name) return toast('Enter a card name');
    if (!data.barcode) return toast('Enter a barcode number');
    try {
      stopCamera();
      if (editingId) {
        const updated = await updateCard(editingId, data);
        cards = cards.map((c) => (c.id === editingId ? updated : c));
        toast('Card updated');
      } else {
        const created = await createCard(data);
        cards.push(created);
        toast('Card added');
      }
      backHome();
    } catch (err) {
      toast('Save failed: ' + err.message);
    }
  });
  actions.appendChild(cancel);
  actions.appendChild(save);
  form.appendChild(actions);

  let mode = card.name ? 'manual' : 'camera';
  let scanning = false;
  let scanStop = null;

  function stopCamera() {
    if (scanStop) scanStop();
    scanStop = null;
    scanning = false;
  }
  activeStopCamera = stopCamera;

  function renderMode() {
    const camera = mode === 'camera';
    frame.hidden = !camera;
    placeholder.hidden = camera;
    scanBox.hidden = camera;
    modeBtn.textContent = camera ? 'Enter manually' : 'Use camera';
  }

  function setMode(m) {
    mode = m;
    renderMode();
  }

  function startCamera() {
    if (scanning) return;
    if (!supportsCamera()) {
      toast('Camera not supported in this browser');
      setMode('manual');
      return;
    }
    if (!isSecureContext()) {
      toast('Camera needs HTTPS. Open the app over https://');
      setMode('manual');
      return;
    }

    scanning = true;
    scanStatus.textContent = 'Starting camera\u2026';

    scanStop = startScanner(
      video,
      (result) => {
        scanInput.value = result.text;
        currentFormat = result.format;
        stopCamera();
        setMode('manual');
        scanStatus.textContent = `Found: ${result.text}`;
        toast('Barcode captured');
      },
      (err) => {
        const msg = (err && err.message) ? err.message : String(err);
        stopCamera();
        setMode('manual');
        scanStatus.textContent = 'Camera error: ' + msg;
        toast('Camera error: ' + msg);
      },
      (state) => {
        scanStatus.textContent = state;
      }
    );
  }

  modeBtn.addEventListener('click', () => {
    if (mode === 'camera') {
      stopCamera();
      setMode('manual');
    } else {
      setMode('camera');
      startCamera();
    }
  });

  renderMode();
  if (mode === 'camera') startCamera();

  return form;
}

/* ---------------- Init ---------------- */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

addBtn.addEventListener('click', openAdd);

loadCards();
