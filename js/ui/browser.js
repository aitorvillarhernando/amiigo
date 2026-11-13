import { state, ui } from '../state.js';
import { getParentPath } from '../ble/pixl-client.js';
import { formatBytes, escapeHtml, escapeAttr } from '../utils.js';
import { log, setStatus, updateMoveBar } from './status.js';

export function renderDrive() {
  if (!state.drive) {
    ui.driveLabel.textContent = '—';
    ui.driveMeta.textContent = '—';
    ui.driveBar.style.width = '0%';
    return;
  }
  const { label, name, totalBytes, freeBytes } = state.drive;
  const used = Math.max(0, totalBytes - freeBytes);
  const pct = totalBytes > 0 ? Math.min(100, (used / totalBytes) * 100) : 0;
  ui.driveLabel.textContent = label ? `${label}:/` : (name || '—');
  ui.driveBar.style.width = `${pct.toFixed(1)}%`;
  ui.driveMeta.textContent = `${formatBytes(used)} usados de ${formatBytes(totalBytes)} · ${formatBytes(freeBytes)} libres`;
}

export function renderPathbar() {
  ui.pathbar.innerHTML = '';
  if (!state.cwd) {
    ui.pathbar.textContent = '—';
    return;
  }
  const parts = state.cwd.replace(/\\+/g, '/').split('/').filter(Boolean);
  let acc = '';
  parts.forEach((p, i) => {
    if (i === 0) acc = p + '/';
    else acc += p + '/';
    const span = document.createElement('span');
    span.className = 'crumb';
    span.textContent = p + (i === 0 ? '/' : '');
    span.dataset.path = acc;
    span.addEventListener('click', () => !state.busy && navigateTo(span.dataset.path));
    ui.pathbar.appendChild(span);
    if (i < parts.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'crumb sep';
      sep.textContent = '/';
      ui.pathbar.appendChild(sep);
    }
  });
}

export function renderFiles() {
  const tbody = ui.fileBody;
  tbody.innerHTML = '';
  if (!state.client || !state.client.connected) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">Conecta un dispositivo para ver sus archivos.</td></tr>';
    return;
  }
  const entries = [...state.entries].sort((a, b) => {
    const ad = (a.type === 'DIR' || a.type === 'dir') ? 0 : 1;
    const bd = (b.type === 'DIR' || b.type === 'dir') ? 0 : 1;
    if (ad !== bd) return ad - bd;
    return a.name.localeCompare(b.name);
  });
  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">Carpeta vacía.</td></tr>';
    return;
  }
  for (const e of entries) {
    const tr = document.createElement('tr');
    const isDir = e.type === 'DIR' || e.type === 'dir';
    const icon = isDir ? '📁' : '📄';
    const size = isDir ? '—' : formatBytes(e.size);
    const type = isDir ? 'Carpeta' : 'Archivo';
    const etype = isDir ? 'dir' : 'file';
    const nameCell = `<div class="name-cell"><span class="icon">${icon}</span><span class="name-link ${isDir ? 'dir' : 'file'}" data-type="${etype}" data-name="${escapeAttr(e.name)}">${escapeHtml(e.name)}</span></div>`;
    const actions = `
      <button class="icon-btn" data-act="move" data-name="${escapeAttr(e.name)}" data-type="${etype}" title="Mover">📦</button>
      <button class="icon-btn" data-act="rename" data-name="${escapeAttr(e.name)}" title="Renombrar">✏️</button>
      <button class="icon-btn" data-act="delete" data-name="${escapeAttr(e.name)}" data-type="${etype}" title="Eliminar">🗑️</button>`;
    tr.innerHTML = `<td>${nameCell}</td><td class="col-size">${size}</td><td class="col-type">${type}</td><td class="col-actions">${actions}</td>`;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('.name-link.dir').forEach(el => {
    el.addEventListener('click', () => {
      if (state.busy) return;
      const name = el.dataset.name;
      const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
      navigateTo(base + name + '/');
    });
  });

  tbody.querySelectorAll('[data-act="rename"]').forEach(btn => btn.addEventListener('click', () => onRename(btn.dataset.name)));
  tbody.querySelectorAll('[data-act="delete"]').forEach(btn => btn.addEventListener('click', () => onDelete(btn.dataset.name, btn.dataset.type)));
  tbody.querySelectorAll('[data-act="move"]').forEach(btn => btn.addEventListener('click', () => onMovePick(btn.dataset.name, btn.dataset.type)));
  tbody.querySelectorAll('.icon-btn').forEach(b => b.disabled = !!state.busy);

  updateMoveBar();
}

export async function navigateTo(path) {
  if (state.busy) return;
  await refreshDriveAndList(path);
}

export async function refreshDriveAndList(path = state.cwd) {
  if (!state.client || !state.client.connected) return;
  try {
    ui.fileBody.innerHTML = '<tr><td colspan="4" class="empty">Cargando…</td></tr>';
    const drivesRes = await state.client.listDrives();
    if (drivesRes.ok && drivesRes.data && drivesRes.data.length) {
      const label = state.drive ? state.drive.label : drivesRes.data[0].label;
      state.drive = drivesRes.data.find(d => d.label === label) || drivesRes.data[0];
    }
    renderDrive();

    const target = path || (state.drive ? state.drive.label + ':/' : 'E:/');
    state.cwd = target;
    const list = await state.client.readFolder(target);
    if (!list.ok) throw new Error(list.error);
    state.entries = list.data || [];
    renderPathbar();
    renderFiles();
    ui.upBtn.disabled = !state.client.connected || !state.drive || state.cwd === (state.drive.label + ':/');
  } catch (err) {
    log(`Error al listar ${path || state.cwd || ''}: ${err.message}`, 'error');
    setStatus(`Error al listar: ${err.message}`, 'error');
    ui.fileBody.innerHTML = `<tr><td colspan="4" class="empty">Error: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// callbacks wired from main/services to avoid cycles - set by init
export let handlers = {
  onRename: async () => {},
  onDelete: async () => {},
  onMovePick: () => {},
};

export function setBrowserHandlers(h) { handlers = { ...handlers, ...h }; }
function onRename(name) { return handlers.onRename(name); }
function onDelete(name, type) { return handlers.onDelete(name, type); }
function onMovePick(name, type) { return handlers.onMovePick(name, type); }
