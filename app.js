import { PixlClient, isWebBluetoothSupported, getParentPath, getBaseName, utf8Length } from './pixl-client.js';

const MAX_FILE_NAME_BYTES = 47;
const MAX_FILE_PATH_BYTES = 63;
const MAX_FOLDER_PATH_BYTES = 55;

const el = (id) => document.getElementById(id);

const state = {
  client: null,
  drive: null,       // {label,name,totalBytes,freeBytes}
  cwd: '',           // e.g. E:/
  entries: [],
  busy: false,
  busyLabel: '',
  abortController: null,
  clipboard: null,   // {path,name,type} for move
};

const ui = {
  supportBadge: el('supportBadge'),
  connectBtn: el('connectBtn'),
  statusBar: el('statusBar'),
  statusSpinner: el('statusSpinner'),
  statusText: el('statusText'),
  devStatus: el('devStatus'),
  devName: el('devName'),
  devVersion: el('devVersion'),
  devAddr: el('devAddr'),
  driveLabel: el('driveLabel'),
  driveBar: el('driveBar'),
  driveMeta: el('driveMeta'),
  refreshBtn: el('refreshBtn'),
  dfuBtn: el('dfuBtn'),
  pathbar: el('pathbar'),
  upBtn: el('upBtn'),
  mkdirBtn: el('mkdirBtn'),
  fileInput: el('fileInput'),
  dirInput: el('dirInput'),
  uploadFilesLabel: el('uploadFilesLabel'),
  uploadDirLabel: el('uploadDirLabel'),
  uploadMultiDirBtn: el('uploadMultiDirBtn'),
  fileBody: el('fileBody'),
  transferList: el('transferList'),
  clearTransfersBtn: el('clearTransfersBtn'),
  log: el('log'),
  moveBar: el('moveBar'),
  moveName: el('moveName'),
  pasteMoveBtn: el('pasteMoveBtn'),
  cancelMoveBtn: el('cancelMoveBtn'),
  pathModal: el('pathModal'),
  pathModalDesc: el('pathModalDesc'),
  pathModalSegments: el('pathModalSegments'),
  pathModalFeedback: el('pathModalFeedback'),
  pathModalPreview: el('pathModalPreview'),
  pathModalSkip: el('pathModalSkip'),
  pathModalOk: el('pathModalOk'),
};

function log(msg, level = 'info') {
  const ts = new Date().toLocaleTimeString();
  const line = `[${ts}] ${msg}`;
  console[level === 'error' ? 'error' : 'log'](msg);
  ui.log.textContent += (ui.log.textContent ? '\n' : '') + line;
  ui.log.scrollTop = ui.log.scrollHeight;
}

function setStatus(text, kind = 'info') {
  if (ui.statusText) ui.statusText.textContent = text;
  else ui.statusBar.textContent = text;
  ui.statusBar.className = `status status-${kind}`;
  if (ui.statusSpinner && !state.busy) ui.statusSpinner.classList.add('hidden');
}

function setBusy(busy, label = '') {
  state.busy = !!busy;
  state.busyLabel = label || '';
  document.body.classList.toggle('app-busy', state.busy);
  if (ui.statusSpinner) {
    if (state.busy && label) {
      ui.statusSpinner.classList.remove('hidden');
      setStatus(label, 'info');
    } else if (!state.busy) {
      ui.statusSpinner.classList.add('hidden');
    }
  }
  setControlsConnected(!!(state.client && state.client.connected));
  renderFiles();
  renderPathbar();
}

function fmtBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / Math.pow(1024, i);
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function setControlsConnected(connected) {
  ui.connectBtn.textContent = connected ? 'Desconectar' : 'Conectar';
  const dis = !connected || state.busy;
  ui.refreshBtn.disabled = dis;
  ui.dfuBtn.disabled = dis;
  ui.upBtn.disabled = dis || !state.cwd || state.cwd === (state.drive ? state.drive.label + ':/' : state.cwd);
  ui.mkdirBtn.disabled = dis;
  ui.fileInput.disabled = dis;
  ui.dirInput.disabled = dis;
  ui.uploadMultiDirBtn.disabled = dis || !('showDirectoryPicker' in window);
  if (ui.pasteMoveBtn) ui.pasteMoveBtn.disabled = dis || !state.clipboard;
  if (ui.cancelMoveBtn) ui.cancelMoveBtn.disabled = !state.clipboard || state.busy;
  if (ui.clearTransfersBtn) ui.clearTransfersBtn.disabled = state.busy;
  if (!('showDirectoryPicker' in window)) {
    ui.uploadMultiDirBtn.title = 'Tu navegador no soporta selección múltiple de carpetas (File System Access API). Usa Chrome/Edge.';
  }
  updateMoveBar();
}

function updateDriveUI() {
  if (!state.drive) {
    ui.driveLabel.textContent = '—';
    ui.driveBar.style.width = '0%';
    ui.driveMeta.textContent = '—';
    return;
  }
  const d = state.drive;
  ui.driveLabel.textContent = `${d.label}: ${d.name || ''}`.trim();
  const used = Math.max(0, (d.totalBytes || 0) - (d.freeBytes || 0));
  const pct = d.totalBytes ? Math.min(100, Math.round((used / d.totalBytes) * 100)) : 0;
  ui.driveBar.style.width = pct + '%';
  ui.driveMeta.textContent = `${fmtBytes(used)} usados de ${fmtBytes(d.totalBytes)} · ${fmtBytes(d.freeBytes)} libres`;
}

function renderPathbar() {
  ui.pathbar.innerHTML = '';
  if (!state.cwd) return;
  // e.g. E:/ or E:/amiibo/folder
  const root = state.cwd.slice(0, 3); // E:/
  const rest = state.cwd.length > 3 ? state.cwd.slice(3).split('/').filter(Boolean) : [];
  const parts = [root, ...rest];
  let acc = root;
  parts.forEach((part, idx) => {
    if (idx > 0) acc = acc.endsWith('/') ? acc + part : acc + '/' + part;
    const span = document.createElement('span');
    span.className = 'crumb' + (state.busy ? ' disabled' : '');
    span.textContent = part;
    const path = acc;
    span.addEventListener('click', () => { if (!state.busy) navigateTo(path); });
    ui.pathbar.appendChild(span);
    if (idx < parts.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'crumb sep';
      sep.textContent = '/';
      ui.pathbar.appendChild(sep);
    }
  });
}

function renderFiles() {
  if (!state.client || !state.client.connected) {
    ui.fileBody.innerHTML = '<tr><td colspan="4" class="empty">Conecta un dispositivo para ver sus archivos.</td></tr>';
    return;
  }
  if (!state.entries.length) {
    ui.fileBody.innerHTML = '<tr><td colspan="4" class="empty">Carpeta vacía.</td></tr>';
    return;
  }
  const disAttr = state.busy ? ' disabled' : '';
  ui.fileBody.innerHTML = state.entries.map(e => {
    const isDir = e.type === 'DIR';
    const icon = isDir ? '📁' : '📄';
    const size = isDir ? '—' : fmtBytes(e.size);
    const type = isDir ? 'Carpeta' : 'Archivo';
    const safeName = escapeHtml(e.name);
    const busyCls = state.busy ? ' disabled' : '';
    const nameHtml = isDir
      ? `<span class="name-link dir${busyCls}" data-action="open" data-name="${safeName}">${safeName}</span>`
      : `<span class="name-link" data-action="none" data-name="${safeName}">${safeName}</span>`;
    const moveBtn = `<button class="icon-btn" data-action="move" data-name="${safeName}" title="Mover"${disAttr}>📦</button>`;
    const renBtn = `<button class="icon-btn" data-action="rename" data-name="${safeName}" title="Renombrar"${disAttr}>✏️</button>`;
    const delBtn = `<button class="icon-btn" data-action="delete" data-name="${safeName}" title="Eliminar"${disAttr}>🗑</button>`;
    return `<tr>
      <td><div class="name-cell"><span class="icon">${icon}</span>${nameHtml}</div></td>
      <td class="col-size">${size}</td>
      <td class="col-type">${type}</td>
      <td class="col-actions">${moveBtn} ${renBtn} ${delBtn}</td>
    </tr>`;
  }).join('');
}

async function refreshDriveAndList(targetPath = state.cwd) {
  if (!state.client || !state.client.connected) return;
  try {
    const drivesRes = await state.client.listDrives();
    if (drivesRes.ok && drivesRes.data.length) {
      // prefer current drive label
      const label = state.drive ? state.drive.label : drivesRes.data[0].label;
      state.drive = drivesRes.data.find(d => d.label === label) || drivesRes.data[0];
      updateDriveUI();
      if (!targetPath) targetPath = state.drive.label + ':/';
    }
    state.cwd = targetPath || (state.drive ? state.drive.label + ':/' : 'E:/');
    const res = await state.client.readFolder(state.cwd);
    if (!res.ok) throw new Error(res.error);
    state.entries = res.data;
    renderPathbar();
    renderFiles();
    setControlsConnected(true);
  } catch (err) {
    log(`Error al listar: ${err.message}`, 'error');
    setStatus(`Error al listar: ${err.message}`, 'error');
  }
}

async function navigateTo(path) {
  if (state.busy) return;
  await refreshDriveAndList(path);
}

function removeEmptyTransferNote() {
  const empty = ui.transferList.querySelector('.empty');
  if (empty) empty.remove();
}

function createTransferGroup(title) {
  removeEmptyTransferNote();
  const group = document.createElement('div');
  group.className = 'transfer-group active';
  group.dataset.status = 'active';
  group.innerHTML = `
    <div class="transfer-group-header">
      <div class="transfer-top">
        <div class="transfer-name"></div>
        <div class="transfer-state t-run">En cola…</div>
      </div>
      <div class="progress"><div class="progress-bar overall-bar" style="width:0%"></div></div>
      <div class="transfer-meta overall-meta"></div>
    </div>
    <div class="transfer-files"></div>`;
  group.querySelector('.transfer-name').textContent = title;
  ui.transferList.prepend(group);
  const overallState = group.querySelector('.transfer-group-header .transfer-state');
  const overallBar = group.querySelector('.overall-bar');
  const overallMeta = group.querySelector('.overall-meta');
  const filesWrap = group.querySelector('.transfer-files');

  const api = {
    setProgress(pct, meta = '') {
      overallBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
      if (meta) overallMeta.textContent = meta;
    },
    setState(text, cls = 't-run') {
      overallState.textContent = text;
      overallState.className = `transfer-state ${cls}`;
    },
    setMeta(text) { overallMeta.textContent = text; },
    markDone() { group.dataset.status = 'done'; group.classList.remove('active'); group.classList.add('done'); },
    addFile(label) {
      const item = document.createElement('div');
      item.className = 'transfer-file-item';
      item.dataset.status = 'active';
      item.innerHTML = `
        <div class="transfer-top">
          <div class="transfer-name file-name"></div>
          <div class="transfer-state t-run">En cola…</div>
        </div>
        <div class="progress progress-sm"><div class="progress-bar" style="width:0%"></div></div>
        <div class="transfer-meta"></div>`;
      item.querySelector('.file-name').textContent = label;
      filesWrap.appendChild(item); // append so order stable; overall header stays on top
      const st = item.querySelector('.transfer-state');
      const bar = item.querySelector('.progress-bar');
      const meta = item.querySelector('.transfer-meta');
      return {
        setProgress(pct, m = '') { bar.style.width = Math.max(0, Math.min(100, pct)) + '%'; if (m) meta.textContent = m; },
        setState(text, cls = 't-run') { st.textContent = text; st.className = `transfer-state ${cls}`; if (cls === 't-ok' || cls === 't-err') item.dataset.status = 'done'; },
        setMeta(text) { meta.textContent = text; }
      };
    }
  };
  return api;
}

async function verifyUpload(remotePath, expectedSize) {
  // list parent and confirm size
  const parent = getParentPath(remotePath);
  const base = getBaseName(remotePath);
  const res = await state.client.readFolder(parent);
  if (!res.ok) throw new Error(`Verificación fallida: no se pudo listar ${parent} (${res.error})`);
  const entry = res.data.find(e => e.type === 'FILE' && e.name === base);
  if (!entry) throw new Error(`Verificación fallida: ${base} no aparece en el dispositivo`);
  if (entry.size !== expectedSize) {
    throw new Error(`Verificación fallida: tamaño ${entry.size} B en dispositivo, esperado ${expectedSize} B`);
  }
  return true;
}

async function uploadQueue(tasks, title) {
  // tasks: [{ file: File, remotePath: string, displayName: string }]
  if (!tasks.length) return;
  setBusy(true, 'Comprobando rutas antes de subir…');

  const cwd = state.cwd || (state.drive ? state.drive.label + ':/' : 'E:/');
  const resolved = await resolvePathIssues(tasks.map(t => ({...t})), cwd);
  if (!resolved) { setBusy(false); return; }
  tasks = resolved.tasks;
  if (resolved.skippedCount > 0) {
    log(`Se omitieron ${resolved.skippedCount} elemento(s) por rutas no válidas.`);
  }
  if (!tasks.length) {
    setStatus('No hay archivos para subir tras omitir rutas no válidas.', 'warn');
    setBusy(false);
    return;
  }

  // switch from "checking paths" busy label to upload mode (transfers show detailed progress)
  if (ui.statusSpinner) ui.statusSpinner.classList.add('hidden');
  setStatus('Subiendo archivos…', 'info');
  state.abortController = new AbortController();
  const group = createTransferGroup(title);
  group.setState('Subiendo…', 't-run');

  let done = 0; let failed = 0;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const item = group.addFile(t.displayName);
    item.setState('Preparando…', 't-run');
    try {
      const parent = getParentPath(t.remotePath);
      await state.client.ensureFolder(parent);
      item.setState('Subiendo…', 't-run');
      await state.client.uploadFile(t.remotePath, t.file, (sent, total) => {
        const pct = total ? (sent / total) * 100 : 100;
        item.setProgress(pct, `${fmtBytes(sent)} / ${fmtBytes(total)}`);
        const overallPct = ((done + sent / Math.max(1,total)) / tasks.length) * 100;
        group.setProgress(overallPct, `${done}/${tasks.length} archivos completados`);
        group.setState(`Subiendo… (${i + 1}/${tasks.length})`, 't-run');
      }, state.abortController.signal);
      item.setState('Verificando…', 't-warn');
      await verifyUpload(t.remotePath, t.file.size);
      item.setProgress(100, `${fmtBytes(t.file.size)} verificados`);
      item.setState('Completado ✓', 't-ok');
      log(`Subido y verificado: ${t.remotePath}`);
      done++;
    } catch (err) {
      failed++;
      item.setState('Error', 't-err');
      item.setMeta(err.message);
      log(`Error subiendo ${t.remotePath}: ${err.message}`, 'error');
      if (String(err.message).includes('cancelada')) break;
    }
    group.setProgress(( (done+failed) / tasks.length) * 100, `${done} ok, ${failed} errores (${i + 1}/${tasks.length})`);
  }

  if (failed === 0) {
    group.setState('Completado ✓', 't-ok');
    setStatus(`Subida completada: ${done} archivo(s) verificados correctamente.${resolved.skippedCount ? ` ${resolved.skippedCount} omitido(s).` : ''}`, 'success');
  } else {
    group.setState(`Finalizado con errores`, failed === tasks.length ? 't-err' : 't-warn');
    setStatus(`Subida finalizada: ${done} ok, ${failed} con error.${resolved.skippedCount ? ` ${resolved.skippedCount} omitido(s).` : ''}`, failed === tasks.length ? 'error' : 'warn');
  }
  group.markDone();
  state.abortController = null;
  setBusy(false);
  await refreshDriveAndList(state.cwd);
}

function joinRemote(baseDir, relPath) {
  const cleanBase = baseDir.endsWith('/') ? baseDir.slice(0, -1) : baseDir;
  const cleanRel = relPath.replace(/^\/+/, '');
  return `${cleanBase}/${cleanRel}`;
}

function isAllowedBinFile(name) {
  return /\.bin$/i.test(name || '');
}

function collectFilesFromInput(fileList, mode) {
  const files = Array.from(fileList || []);
  let tasks = [];
  let omitted = 0;
  if (mode === 'dir') {
    for (const f of files) {
      const rel = (f.webkitRelativePath || f.name).replace(/\\/g, '/');
      if (!isAllowedBinFile(f.name)) { omitted++; continue; }
      const remotePath = joinRemote(state.cwd || 'E:/', rel);
      tasks.push({ file: f, remotePath, displayName: rel });
    }
  } else {
    for (const f of files) {
      if (!isAllowedBinFile(f.name)) { omitted++; continue; }
      const remotePath = joinRemote(state.cwd || 'E:/', f.name);
      tasks.push({ file: f, remotePath, displayName: f.name });
    }
  }
  if (omitted > 0) {
    log(`Se omitieron ${omitted} archivo(s) por no tener extensión .bin.`);
    setStatus(`Se omitieron ${omitted} archivo(s) (solo se permiten .bin).`, 'warn');
  }
  return tasks;
}

function pathNameIssues(name, kind) {
  // kind: 'dir' or 'file'
  if (!name) return 'El nombre no puede estar vacío.';
  if (/[\\/]/.test(name)) return 'El nombre no puede contener / ni \\.';
  if (utf8Length(name) > MAX_FILE_NAME_BYTES) return `Nombre demasiado largo (${utf8Length(name)} bytes, máx. ${MAX_FILE_NAME_BYTES}).`;
  return null;
}

function remotePathIssue(remotePath, kind) {
  // kind: 'folder' or 'file'
  const limit = kind === 'folder' ? MAX_FOLDER_PATH_BYTES : MAX_FILE_PATH_BYTES;
  const len = utf8Length(remotePath);
  if (len > limit) return `Ruta demasiado larga (${len} bytes, máx. ${limit}).`;
  const base = getBaseName(remotePath);
  const ni = pathNameIssues(base, kind === 'folder' ? 'dir' : 'file');
  if (ni) return ni;
  return null;
}

/* openPathFixModal and resolvePathIssues reimplemented above to support per-segment editing */

function relSegmentsFromRemote(cwd, remotePath) {
  const base = cwd.endsWith('/') ? cwd : cwd + '/';
  let rel = remotePath.startsWith(base) ? remotePath.slice(base.length) : remotePath.slice(cwd.length).replace(/^\//,'');
  return rel.split('/').filter(Boolean);
}

function applySegmentRenames(tasks, cwd, oldSegs, newSegs) {
  // Apply renames for directory segments (all except maybe last if file differs per-task context handled separately)
  // We rename directory prefixes globally: for each index i where segment changed and it's a directory level for some paths
  const base = cwd.endsWith('/') ? cwd : cwd + '/';
  for (let i = 0; i < oldSegs.length; i++) {
    if (oldSegs[i] === newSegs[i]) continue;
    const oldPrefix = base + oldSegs.slice(0, i + 1).join('/');
    const newPrefix = base + newSegs.slice(0, i + 1).join('/');
    for (const t of tasks) {
      if (t.remotePath === oldPrefix) {
        t.remotePath = newPrefix;
      } else if (t.remotePath.startsWith(oldPrefix + '/')) {
        t.remotePath = newPrefix + t.remotePath.slice(oldPrefix.length);
      }
    }
    // update oldSegs prefix for subsequent iterations? we've built newPrefix from newSegs so fine
  }
}

function computePathValidation(cwd, segments, kinds) {
  // kinds[i] 'dir' or 'file'; returns { ok, message, segmentHints:[{ok,message}], finalPath }
  const base = cwd.endsWith('/') ? cwd.slice(0,-1) : cwd;
  const segmentHints = segments.map(() => ({ ok: true, message: '' }));
  let ok = true;
  let message = 'Ruta correcta.';

  for (let i = 0; i < segments.length; i++) {
    const name = segments[i];
    const kind = kinds[i];
    const ni = pathNameIssues(name, kind);
    if (ni) {
      segmentHints[i] = { ok: false, message: ni };
      ok = false;
    } else {
      const limitNote = kind === 'file' ? MAX_FILE_PATH_BYTES : MAX_FOLDER_PATH_BYTES;
      segmentHints[i] = { ok: true, message: `Correcto (${utf8Length(name)} B nombre)` };
    }
  }

  // build incremental paths
  let cur = base;
  for (let i = 0; i < segments.length; i++) {
    cur = cur + '/' + segments[i];
    const kind = kinds[i] === 'file' ? 'file' : 'folder';
    const limit = kind === 'folder' ? MAX_FOLDER_PATH_BYTES : MAX_FILE_PATH_BYTES;
    const len = utf8Length(cur);
    if (len > limit) {
      ok = false;
      const msg = `Ruta de ${kind === 'folder' ? 'carpeta' : 'archivo'} demasiado larga (${len} B, máx. ${limit}).`;
      segmentHints[i] = { ok: false, message: (segmentHints[i].ok ? msg : segmentHints[i].message + ' ' + msg) };
      message = msg;
    }
  }

  const finalPath = cur;
  if (ok) message = `Ruta correcta (${utf8Length(finalPath)} bytes).`;
  else {
    // pick first error as main message
    const firstBad = segmentHints.find(h => !h.ok);
    if (firstBad) message = firstBad.message;
  }
  return { ok, message, segmentHints, finalPath };
}

function openPathFixModal({ title, description, cwd, segments, kinds }) {
  return new Promise((resolve) => {
    ui.pathModal.classList.remove('hidden');
    ui.pathModal.setAttribute('aria-hidden', 'false');
    el('pathModalTitle').textContent = title || 'Ruta o nombre no válido';
    ui.pathModalDesc.textContent = description || '';
    ui.pathModalSegments.innerHTML = '';

    const inputs = segments.map((seg, i) => {
      const row = document.createElement('div');
      row.className = 'segment-row';
      const label = document.createElement('div');
      label.className = 'segment-label';
      label.innerHTML = `<strong>${kinds[i] === 'file' ? 'Archivo' : 'Carpeta'}</strong>${i + 1} de ${segments.length}`;
      const field = document.createElement('div');
      field.className = 'segment-field';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = seg;
      input.autocomplete = 'off';
      input.spellcheck = false;
      const hint = document.createElement('div');
      hint.className = 'segment-hint';
      field.appendChild(input);
      field.appendChild(hint);
      row.appendChild(label);
      row.appendChild(field);
      ui.pathModalSegments.appendChild(row);
      return { input, hint, kind: kinds[i] };
    });

    const cleanup = (result) => {
      ui.pathModal.classList.add('hidden');
      ui.pathModal.setAttribute('aria-hidden', 'true');
      inputs.forEach(({input}) => input.oninput = null);
      ui.pathModalOk.onclick = null;
      ui.pathModalSkip.onclick = null;
      ui.pathModalSegments.innerHTML = '';
      ui.pathModalFeedback.textContent = '';
      ui.pathModalFeedback.className = 'modal-feedback';
      resolve(result);
    };

    const update = () => {
      const vals = inputs.map(x => x.input.value);
      const v = computePathValidation(cwd, vals, kinds);
      ui.pathModalPreview.textContent = v.finalPath;
      v.segmentHints.forEach((h, i) => {
        inputs[i].input.classList.toggle('valid', h.ok);
        inputs[i].input.classList.toggle('invalid', !h.ok);
        inputs[i].hint.textContent = h.message;
        inputs[i].hint.className = 'segment-hint ' + (h.ok ? 'ok' : 'err');
      });
      ui.pathModalFeedback.textContent = v.message;
      ui.pathModalFeedback.className = 'modal-feedback ' + (v.ok ? 'ok' : 'err');
      ui.pathModalOk.disabled = !v.ok;
    };

    inputs.forEach(({input}) => input.addEventListener('input', update));
    ui.pathModalOk.onclick = () => cleanup({ action: 'apply', values: inputs.map(x => x.input.value) });
    ui.pathModalSkip.onclick = () => cleanup({ action: 'skip' });
    update();
    setTimeout(() => inputs[0]?.input.focus(), 0);
  });
}

async function resolvePathIssues(tasks, cwd) {
  let skippedCount = 0;
  const skipSet = new Set();

  // iterate until stable
  let safety = 0;
  while (safety++ < 5000) {
    // find first problematic task (file) or dir path
    let problem = null;
    for (const t of tasks) {
      if (skipSet.has(t)) continue;
      // check each directory prefix and file
      const segs = relSegmentsFromRemote(cwd, t.remotePath);
      const kinds = segs.map((_, i) => i === segs.length - 1 ? 'file' : 'dir');
      let cur = cwd.endsWith('/') ? cwd.slice(0,-1) : cwd;
      for (let i = 0; i < segs.length; i++) {
        cur = cur + '/' + segs[i];
        const kind = kinds[i] === 'file' ? 'file' : 'folder';
        const issue = remotePathIssue(cur, kind);
        if (issue) { problem = { task: t, segs, kinds, issue, level: i }; break; }
      }
      if (problem) break;
    }
    if (!problem) break;

    const { task, segs, kinds, issue } = problem;
    const res = await openPathFixModal({
      title: 'Ajustar ruta/nombres (directorios y archivo)',
      description: `Se ha encontrado un problema: ${issue}\nPuedes renombrar cualquier carpeta o el archivo para que la ruta cumpla los límites. Los cambios en carpetas se aplican a todo su contenido. La ruta es correcta cuando se muestra en verde.`,
      cwd,
      segments: segs.slice(),
      kinds: kinds.slice(),
    });
    if (!res || res.action === 'skip') {
      // skip this task; if directory-level issue better to skip subtree? determine offending dir prefix
      // compute first bad level again with original segs
      let cur = cwd.endsWith('/') ? cwd.slice(0,-1) : cwd;
      let badLevel = segs.length - 1;
      for (let i = 0; i < segs.length; i++) {
        cur = cur + '/' + segs[i];
        const kind = kinds[i] === 'file' ? 'file' : 'folder';
        if (remotePathIssue(cur, kind)) { badLevel = i; break; }
      }
      if (kinds[badLevel] === 'dir') {
        const dirPrefix = (cwd.endsWith('/') ? cwd : cwd + '/') + segs.slice(0, badLevel + 1).join('/');
        for (const t of tasks) {
          if (!skipSet.has(t) && (t.remotePath === dirPrefix || t.remotePath.startsWith(dirPrefix + '/'))) { skipSet.add(t); skippedCount++; }
        }
      } else {
        if (!skipSet.has(task)) { skipSet.add(task); skippedCount++; }
      }
      continue;
    } else if (res.action === 'apply') {
      const newSegs = res.values;
      // apply directory renames globally for each changed dir segment
      for (let i = 0; i < newSegs.length - 1; i++) { // directory segments
        if (newSegs[i] !== segs[i]) {
          // rename this specific directory prefix (as it was at this point for this path)
          // compute old prefix based on current segs state for this task? we need to apply against all tasks matching old prefix
          const oldPrefix = (cwd.endsWith('/') ? cwd : cwd + '/') + segs.slice(0, i + 1).join('/');
          const newName = newSegs[i];
          const parent = getParentPath(oldPrefix);
          const newPrefix = joinRemote(parent, newName);
          for (const t of tasks) {
            if (t.remotePath === oldPrefix) t.remotePath = newPrefix;
            else if (t.remotePath.startsWith(oldPrefix + '/')) t.remotePath = newPrefix + t.remotePath.slice(oldPrefix.length);
          }
          // update segs reference for subsequent dir renames in same apply
          segs[i] = newSegs[i];
        }
      }
      // file rename (last segment) applies only to this task
      const last = newSegs.length - 1;
      if (newSegs[last] !== relSegmentsFromRemote(cwd, task.remotePath)[last]) {
        // recompute current task segs after dir renames
        const curSegs = relSegmentsFromRemote(cwd, task.remotePath);
        curSegs[last] = newSegs[last];
        task.remotePath = joinRemote(cwd.endsWith('/') ? cwd.slice(0,-1) : cwd, curSegs.join('/'));
      } else {
        // ensure task path matches segs after dir renames (it already does via global replace)
      }
      // update displayName best effort
      const finalRel = relSegmentsFromRemote(cwd, task.remotePath).join('/');
      task.displayName = finalRel;
    }
  }

  const finalTasks = tasks.filter(t => !skipSet.has(t));
  return { tasks: finalTasks, skippedCount };
}

async function readDirHandleRecursive(dirHandle, prefix) {
  const out = [];
  for await (const [name, handle] of dirHandle.entries()) {
    const rel = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'file') {
      if (!isAllowedBinFile(name)) continue;
      const file = await handle.getFile();
      out.push({ file, rel });
    } else if (handle.kind === 'directory') {
      const sub = await readDirHandleRecursive(handle, rel);
      out.push(...sub);
    }
  }
  return out;
}

// --- Event handlers ---

ui.connectBtn.addEventListener('click', async () => {
  if (state.client && state.client.connected) {
    state.client.disconnect();
    return;
  }
  try {
    state.client = new PixlClient((m) => log(m));
    state.client.onDisconnect = ({ intentional }) => {
      ui.devStatus.textContent = 'Desconectado';
      ui.devName.textContent = '—';
      ui.devVersion.textContent = '—';
      ui.devAddr.textContent = '—';
      state.drive = null; state.cwd = ''; state.entries = []; state.clipboard = null;
      updateDriveUI(); renderPathbar(); renderFiles(); setControlsConnected(false);
      if (!intentional) setStatus('Dispositivo desconectado inesperadamente.', 'warn');
      else setStatus('Desconectado.', 'info');
      log(intentional ? 'Desconectado.' : 'Dispositivo desconectado inesperadamente.');
    };
    setStatus('Conectando… selecciona tu dispositivo en el cuadro del navegador.', 'info');
    log('Iniciando conexión BLE…');
    await state.client.connect();
    log('Enlace BLE establecido. Obteniendo información del dispositivo…');
    setStatus('Conectado. Obteniendo información del dispositivo…', 'info');
    ui.devStatus.textContent = 'Conectado';
    ui.devName.textContent = state.client.device?.name || '—';
    try {
      const ver = await state.client.getVersion();
      if (ver.ok) {
        ui.devVersion.textContent = ver.data.version || '—';
        ui.devAddr.textContent = ver.data.bleAddress || '—';
      } else {
        log(`No se pudo leer la versión: ${ver.error}`, 'error');
      }
    } catch (ve) {
      log(`No se pudo leer la versión: ${ve.message}`, 'error');
    }
    setControlsConnected(true);
    setStatus('Conectado. Cargando archivos…', 'success');
    await refreshDriveAndList();
    setStatus('Listo. Puedes subir archivos o carpetas.', 'success');
  } catch (err) {
    log(`Conexión fallida: ${err.message}`, 'error');
    setStatus(`No se pudo conectar: ${err.message}`, 'error');
    setControlsConnected(false);
  }
});

ui.refreshBtn.addEventListener('click', () => refreshDriveAndList(state.cwd));
ui.upBtn.addEventListener('click', () => {
  if (!state.cwd || !state.drive) return;
  const root = state.drive.label + ':/';
  if (state.cwd === root) return;
  navigateTo(getParentPath(state.cwd));
});

ui.mkdirBtn.addEventListener('click', async () => {
  if (!state.client || !state.client.connected || state.busy) return;
  const name = prompt('Nombre de la nueva carpeta:');
  if (!name) return;
  if (/[\\]/.test(name)) { alert('Nombre inválido.'); return; }
  const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
  const path = base + name.replace(/^\/+|\/+$/g, '');
  let ok = false; let errMsg = '';
  try {
    setBusy(true, `Creando carpeta "${name}"…`);
    const res = await state.client.createFolder(path);
    if (!res.ok) throw new Error(res.error);
    log(`Carpeta creada: ${path}`);
    await refreshDriveAndList(state.cwd);
    ok = true;
  } catch (err) {
    errMsg = err.message;
    log(`Error creando carpeta: ${err.message}`, 'error');
  } finally {
    setBusy(false);
  }
  if (ok) setStatus(`Carpeta creada: ${name}`, 'success');
  else setStatus(`Error creando carpeta: ${errMsg}`, 'error');
});

function validateNameOnly(name, kind) {
  if (!name) return 'El nombre no puede estar vacío.';
  if (/[\\/]/.test(name)) return 'El nombre no puede contener / ni \\.';
  const len = utf8Length(name);
  if (len > MAX_FILE_NAME_BYTES) return `Nombre demasiado largo (${len} bytes, máx. ${MAX_FILE_NAME_BYTES}).`;
  return null;
}

async function renameRemoteEntry(oldName, kind) {
  if (state.busy) return;
  const baseDir = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
  const oldPath = baseDir + oldName;
  let proposed = oldName;
  while (true) {
    const input = prompt(`Nuevo nombre para ${kind === 'dir' ? 'la carpeta' : 'el archivo'}:\n(Deja en blanco o cancela para no cambiar)`, proposed);
    if (input == null) return;
    const newName = input.trim();
    if (!newName || newName === oldName) return;
    const err = validateNameOnly(newName, kind);
    if (err) { alert(err); proposed = newName; continue; }
    const newPath = baseDir + newName;
    // validate resulting path length
    const pathKind = kind === 'dir' ? 'folder' : 'file';
    const limit = pathKind === 'folder' ? MAX_FOLDER_PATH_BYTES : MAX_FILE_PATH_BYTES;
    if (utf8Length(newPath) > limit) { alert(`La ruta resultante sería demasiado larga (${utf8Length(newPath)} bytes, máx. ${limit}). Usa un nombre más corto.`); proposed = newName; continue; }
    let ok = false;
    let errMsg = '';
    try {
      setBusy(true, `Renombrando "${oldName}"…`);
      const res = await state.client.renamePath(oldPath, newPath);
      if (!res.ok) throw new Error(res.error);
      log(`Renombrado: ${oldPath} -> ${newPath}`);
      await refreshDriveAndList(state.cwd);
      ok = true;
    } catch (e) {
      errMsg = e.message;
      log(`Error renombrando: ${e.message}`, 'error');
      alert(`No se pudo renombrar: ${e.message}`);
    } finally {
      setBusy(false);
    }
    if (ok) setStatus(`Renombrado correctamente: ${newName}`, 'success');
    else setStatus(`Error renombrando: ${errMsg}`, 'error');
    return;
  }
}

function updateMoveBar() {
  if (!ui.moveBar) return;
  if (state.clipboard) {
    ui.moveBar.classList.remove('hidden');
    ui.moveName.textContent = `${state.clipboard.name} (${state.clipboard.type === 'DIR' ? 'carpeta' : 'archivo'})`;
  } else {
    ui.moveBar.classList.add('hidden');
    ui.moveName.textContent = '';
  }
  if (ui.pasteMoveBtn) ui.pasteMoveBtn.disabled = !state.clipboard || state.busy || !state.client?.connected;
  if (ui.cancelMoveBtn) ui.cancelMoveBtn.disabled = !state.clipboard || state.busy;
}

ui.fileBody.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const name = target.dataset.name;
  if (action === 'open') {
    const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
    navigateTo(base + name);
  } else if (action === 'move') {
    if (state.busy) return;
    const entry = state.entries.find(x => x.name === name);
    const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
    state.clipboard = { path: base + name, name, type: entry ? entry.type : 'FILE' };
    updateMoveBar();
    setControlsConnected(!!state.client?.connected);
    setStatus(`"${name}" listo para mover. Navega a la carpeta destino y pulsa "Mover aquí".`, 'info');
  } else if (action === 'rename') {
    const entry = state.entries.find(x => x.name === name);
    await renameRemoteEntry(name, entry && entry.type === 'DIR' ? 'dir' : 'file');
  } else if (action === 'delete') {
    if (state.busy) return;
    const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
    const path = base + name;
    if (!confirm(`¿Eliminar "${name}" del dispositivo?\n\nEsta acción no se puede deshacer.`)) return;
    let ok = false; let errMsg = '';
    try {
      setBusy(true, `Eliminando "${name}"…`);
      const res = await state.client.removePath(path);
      if (!res.ok) throw new Error(res.error);
      log(`Eliminado: ${path}`);
      await refreshDriveAndList(state.cwd);
      ok = true;
    } catch (err) {
      errMsg = err.message;
      log(`Error eliminando: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
    if (ok) setStatus(`Eliminado: ${name}`, 'success');
    else setStatus(`Error eliminando: ${errMsg}`, 'error');
  }
});

ui.cancelMoveBtn.addEventListener('click', () => {
  state.clipboard = null;
  updateMoveBar();
  setControlsConnected(!!state.client?.connected);
  setStatus('Movimiento cancelado.', 'info');
});

ui.pasteMoveBtn.addEventListener('click', async () => {
  if (!state.clipboard || !state.client?.connected || state.busy) return;
  const src = state.clipboard.path;
  const destBase = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
  const dest = destBase + state.clipboard.name;
  if (src === dest) { setStatus('El elemento ya está en esta carpeta.', 'warn'); return; }
  // prevent moving a folder into itself or its descendant
  if (state.clipboard.type === 'DIR' && (dest === src || dest.startsWith(src + '/'))) {
    setStatus('No puedes mover una carpeta dentro de sí misma.', 'error');
    return;
  }
  // validate dest path length
  const kind = state.clipboard.type === 'DIR' ? 'folder' : 'file';
  const limit = kind === 'folder' ? MAX_FOLDER_PATH_BYTES : MAX_FILE_PATH_BYTES;
  if (utf8Length(dest) > limit) {
    setStatus(`No se puede mover: la ruta destino es demasiado larga (${utf8Length(dest)} B, máx. ${limit}). Renombra el elemento o elige otra ubicación.`, 'error');
    return;
  }
  if (utf8Length(state.clipboard.name) > MAX_FILE_NAME_BYTES) {
    setStatus(`No se puede mover: nombre demasiado largo.`, 'error');
    return;
  }
  // conflict check
  const conflict = state.entries.find(e => e.name === state.clipboard.name);
  if (conflict) {
    if (!confirm(`Ya existe "${state.clipboard.name}" en esta carpeta. ¿Intentar mover igualmente? (puede fallar o sobrescribir según el dispositivo)`)) return;
  }
  const movingName = state.clipboard.name;
  let ok = false; let errMsg = '';
  try {
    setBusy(true, `Moviendo "${movingName}"…`);
    const res = await state.client.renamePath(src, dest);
    if (!res.ok) throw new Error(res.error);
    log(`Movido: ${src} -> ${dest}`);
    state.clipboard = null;
    await refreshDriveAndList(state.cwd);
    ok = true;
  } catch (err) {
    errMsg = err.message;
    log(`Error moviendo: ${err.message}`, 'error');
  } finally {
    setBusy(false);
  }
  if (ok) setStatus(`Movido correctamente: ${movingName}`, 'success');
  else setStatus(`Error al mover: ${errMsg}`, 'error');
});

ui.fileInput.addEventListener('change', async (e) => {
  const tasks = collectFilesFromInput(e.target.files, 'files');
  e.target.value = '';
  if (!tasks.length) {
    setStatus('No hay archivos .bin válidos para subir.', 'warn');
    return;
  }
  await uploadQueue(tasks, `Subida de ${tasks.length} archivo(s) .bin`);
});

ui.dirInput.addEventListener('change', async (e) => {
  const tasks = collectFilesFromInput(e.target.files, 'dir');
  e.target.value = '';
  if (!tasks.length) {
    setStatus('No se encontraron archivos .bin en la carpeta seleccionada.', 'warn');
    return;
  }
  const title = `Subida de carpeta (${tasks.length} archivo(s) .bin)`;
  await uploadQueue(tasks, title);
});

ui.uploadMultiDirBtn.addEventListener('click', async () => {
  if (!state.client || !state.client.connected || state.busy) return;
  if (!('showDirectoryPicker' in window)) {
    setStatus('Tu navegador no soporta selección múltiple de carpetas. Usa Chrome o Edge recientes.', 'error');
    return;
  }
  try {
    setBusy(true);
    const selected = [];
    while (true) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'read' });
        selected.push(handle);
        const more = confirm(`Carpeta añadida: "${handle.name}".\n\n¿Quieres seleccionar otra carpeta para subirla en la misma tanda?\n\nAceptar = añadir otra, Cancelar = continuar con ${selected.length} carpeta(s).`);
        if (!more) break;
      } catch (err) {
        if (err && err.name === 'AbortError') break; // user cancelled picker
        throw err;
      }
    }
    if (!selected.length) { setBusy(false); return; }

    setStatus('Leyendo carpetas seleccionadas…', 'info');
    const allTasks = [];
    const cwd = state.cwd || 'E:/';
    for (const dirHandle of selected) {
      const files = await readDirHandleRecursive(dirHandle, dirHandle.name);
      for (const f of files) {
        const remotePath = joinRemote(cwd, f.rel);
        allTasks.push({ file: f.file, remotePath, displayName: f.rel });
      }
    }
    if (!allTasks.length) {
      setStatus('Las carpetas seleccionadas no contienen archivos .bin (solo se permiten .bin).', 'warn');
      setBusy(false);
      return;
    }
    // uploadQueue will manage busy state for the actual upload
    setBusy(false);
    const folderNames = selected.map(h => h.name).join(', ');
    await uploadQueue(allTasks, `Subida de ${selected.length} carpeta(s) (${allTasks.length} archivo(s) .bin): ${folderNames}`);
  } catch (err) {
    log(`Error seleccionando carpetas: ${err.message}`, 'error');
    setStatus(`Error seleccionando carpetas: ${err.message}`, 'error');
    setBusy(false);
  }
});

async function fetchLatestPixlRelease() {
  try {
    const resp = await fetch('https://api.github.com/repos/solosky/pixl.js/releases/latest', {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const tag = data.tag_name || data.name || '';
    const url = data.html_url || 'https://github.com/solosky/pixl.js/releases';
    return { tag, url };
  } catch (_) {
    return null;
  }
}

ui.dfuBtn.addEventListener('click', async () => {
  if (!state.client || !state.client.connected || state.busy) return;

  const currentVer = ui.devVersion.textContent && ui.devVersion.textContent !== '—' ? ui.devVersion.textContent : 'desconocida';
  setBusy(true, 'Comprobando información de firmware…');
  const latest = await fetchLatestPixlRelease();
  setBusy(false);
  if (state.client?.connected) setStatus('Listo. Puedes subir archivos o carpetas.', 'info');

  let msg = `Actualización de firmware del dispositivo\n\n`;
  msg += `Versión actual detectada: ${currentVer}\n`;
  if (latest && latest.tag) {
    msg += `Última versión publicada (Pixl.js): ${latest.tag}\n`;
  } else {
    msg += `No se pudo consultar la última versión automáticamente.\n`;
  }
  msg += `\nEl proceso consiste en:\n`;
  msg += `1) Reiniciar el dispositivo en modo DFU (actualización).\n`;
  msg += `2) Abrir la herramienta web de DFU y seleccionar el paquete de firmware (.zip) adecuado para tu dispositivo.\n`;
  msg += `   - Releases de Pixl.js: https://github.com/solosky/pixl.js/releases\n`;
  msg += `\n¿Quieres poner el dispositivo en modo DFU ahora?`;

  if (!confirm(msg)) return;

  try {
    setBusy(true, 'Enviando comando de actualización (DFU)…');
    const res = await state.client.enterDfu();
    setBusy(false);
    if (res.ok) {
      setStatus('Dispositivo en modo DFU. Abre la herramienta de actualización para flashear el firmware.', 'warn');
      log('Comando DFU enviado correctamente. Dispositivo reiniciando en modo DFU.');
      const openTool = confirm(
        `El dispositivo debería estar en modo DFU.\n\n` +
        `¿Abrir ahora la herramienta web de actualización (Nordic Secure DFU)?\n` +
        `Allí podrás conectar el dispositivo en modo DFU y seleccionar el archivo .zip del firmware.\n\n` +
        (latest && latest.url ? `Releases/firmware: ${latest.url}\n\n` : `Releases/firmware: https://github.com/solosky/pixl.js/releases\n\n`) +
        `Herramienta DFU: https://thegecko.github.io/web-bluetooth-dfu/examples/web.html`
      );
      if (openTool) {
        window.open('https://thegecko.github.io/web-bluetooth-dfu/examples/web.html', '_blank', 'noopener');
      }
    } else {
      setStatus(`Error al entrar en modo DFU: ${res.error}`, 'error');
      log(`Error DFU: ${res.error}`, 'error');
    }
  } catch (err) {
    setBusy(false);
    setStatus(`Error DFU: ${err.message}`, 'error');
    log(`Error DFU: ${err.message}`, 'error');
  }
});

ui.clearTransfersBtn.addEventListener('click', () => {
  if (state.busy) return;
  // keep active uploads; remove only finished groups/items
  const groups = Array.from(ui.transferList.querySelectorAll('.transfer-group'));
  if (groups.length) {
    groups.forEach(g => { if (g.dataset.status !== 'active') g.remove(); });
  } else {
    // legacy/fallback items
    Array.from(ui.transferList.querySelectorAll('.transfer-item, .transfer-file-item')).forEach(elm => {
      if (elm.dataset.status !== 'active') elm.remove();
    });
  }
  if (!ui.transferList.children.length) {
    ui.transferList.innerHTML = '<div class="empty muted">No hay transferencias en curso.</div>';
  }
});

// --- Init ---
(function init() {
  if (isWebBluetoothSupported()) {
    ui.supportBadge.textContent = 'Web Bluetooth disponible';
    ui.supportBadge.className = 'badge badge-ok';
  } else {
    ui.supportBadge.textContent = 'Web Bluetooth no disponible';
    ui.supportBadge.className = 'badge badge-bad';
    ui.connectBtn.disabled = true;
    setStatus('Este navegador no soporta Web Bluetooth. Usa Chrome o Edge en escritorio/Android.', 'error');
    log('Web Bluetooth no soportado en este navegador.', 'error');
  }
  setControlsConnected(false);
  renderFiles();
})();
