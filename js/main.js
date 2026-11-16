import { state, ui } from './state.js';
import { getParentPath } from './ble/pixl-client.js';
import { initI18n, setLang, getLang, t } from './i18n.js';
import { log, setStatus, setControlsConnected } from './ui/status.js';
import { renderDrive, renderFiles, renderPathbar, refreshDriveAndList, setBrowserHandlers } from './ui/browser.js';
import { clearCompletedTransfers } from './ui/transfers.js';
import { collectSelectedFiles, pickMultipleDirectories, uploadTasks } from './services/upload.js';
import {
  initBluetoothSupport,
  toggleConnect,
  createFolder,
  onRename,
  onDelete,
  onMovePick,
  pasteMove,
  cancelMove,
  updateFirmwareFlow,
  downloadFile,
  formatDriveAction,
  downloadDirectory,
  backupDrive,
} from './services/device.js';

setBrowserHandlers({ onRename, onDelete, onMovePick, onDownload: downloadFile, onDownloadDir: downloadDirectory });

const lang = initI18n();
if (ui.langSelect) {
  ui.langSelect.value = lang;
  ui.langSelect.addEventListener('change', () => {
    setLang(ui.langSelect.value);
  });
}

document.addEventListener('langchange', () => {
  // refresh dynamic UI texts
  initBluetoothSupport(true);
  setControlsConnected(!!(state.client && state.client.connected));
  renderDrive();
  renderFiles();
  renderPathbar();
});

ui.connectBtn.addEventListener('click', toggleConnect);
ui.refreshBtn.addEventListener('click', () => refreshDriveAndList(state.cwd));
if (ui.backupBtn) ui.backupBtn.addEventListener('click', backupDrive);
ui.upBtn.addEventListener('click', () => {
  if (!state.cwd || !state.drive) return;
  const root = state.drive.label + ':/';
  if (state.cwd === root) return;
  if (state.busy) return;
  refreshDriveAndList(getParentPath(state.cwd));
});

ui.mkdirBtn.addEventListener('click', createFolder);

ui.fileInput.addEventListener('change', async (e) => {
  if (!state.client || !state.client.connected || state.busy) return;
  const tasks = await collectSelectedFiles(e.target.files, { isDirectory: false });
  e.target.value = '';
  if (!tasks.length) { setStatus(t('status.selectBinFiles'), 'warn'); return; }
  const title = document.documentElement.lang === 'en'
    ? `Upload ${tasks.length} file(s)`
    : `Subida de ${tasks.length} archivo(s)`;
  await uploadTasks(tasks, title);
});

ui.dirInput.addEventListener('change', async (e) => {
  if (!state.client || !state.client.connected || state.busy) return;
  const tasks = await collectSelectedFiles(e.target.files, { isDirectory: true });
  e.target.value = '';
  if (!tasks.length) { setStatus(t('status.folderNoBin'), 'warn'); return; }
  const dirName = (tasks[0].relativePath || '').split('/')[0] || (document.documentElement.lang === 'en' ? 'folder' : 'carpeta');
  const title = document.documentElement.lang === 'en'
    ? `Folder: ${dirName} (${tasks.length} .bin file(s))`
    : `Carpeta: ${dirName} (${tasks.length} archivo(s) .bin)`;
  await uploadTasks(tasks, title);
});

ui.uploadMultiDirBtn.addEventListener('click', async () => {
  if (!state.client || !state.client.connected || state.busy) return;
  try {
    const tasks = await pickMultipleDirectories();
    if (tasks == null) { setStatus(t('status.multiDirUnsupported'), 'warn'); return; }
    if (!tasks.length) { setStatus(t('status.multiDirNone'), 'warn'); return; }
    const rootNames = Array.from(new Set(tasks.map(t => (t.relativePath || '').split('/')[0]).filter(Boolean)));
    const label = rootNames.length <= 3 ? rootNames.join(', ') : `${rootNames.slice(0,3).join(', ')} (+${rootNames.length - 3})`;
    const title = document.documentElement.lang === 'en'
      ? `Multiple folders: ${label} (${tasks.length} .bin file(s))`
      : `Varias carpetas: ${label} (${tasks.length} archivo(s) .bin)`;
    await uploadTasks(tasks, title);
  } catch (err) {
    log(t('log.errorSelectingFolders', { msg: err.message }), 'error');
    setStatus(t('msg.errorSelectingFolders', { msg: err.message }), 'error');
  }
});

ui.clearTransfersBtn.addEventListener('click', clearCompletedTransfers);
ui.pasteMoveBtn.addEventListener('click', pasteMove);
ui.cancelMoveBtn.addEventListener('click', cancelMove);
ui.dfuBtn.addEventListener('click', updateFirmwareFlow);
if (ui.formatBtn) ui.formatBtn.addEventListener('click', formatDriveAction);

if (ui.searchInput) {
  ui.searchInput.addEventListener('input', () => {
    state.filter = ui.searchInput.value || '';
    renderFiles();
  });
}
if (ui.lowercaseUploadToggle) {
  ui.lowercaseUploadToggle.addEventListener('change', () => {
    state.lowercaseOnUpload = !!ui.lowercaseUploadToggle.checked;
  });
}
if (ui.clearLogBtn) {
  ui.clearLogBtn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (ui.log) ui.log.textContent = '';
  });
}
if (ui.copyLogBtn) {
  ui.copyLogBtn.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    try {
      await navigator.clipboard.writeText(ui.log?.textContent || '');
      setStatus(t('log.copied'), 'success');
    } catch (_) {
      setStatus(t('log.copyFailed'), 'error');
    }
  });
}

async function traverseEntry(entry, prefix = '') {
  if (!entry) return [];
  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
    const rel = prefix ? `${prefix}/${file.name}` : file.name;
    return [{ file, relativePath: rel }];
  }
  if (entry.isDirectory) {
    const dirName = prefix ? `${prefix}/${entry.name}` : entry.name;
    const reader = entry.createReader();
    const entries = [];
    while (true) {
      const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch || !batch.length) break;
      entries.push(...batch);
    }
    const out = [];
    for (const ent of entries) {
      out.push(...await traverseEntry(ent, dirName));
    }
    return out;
  }
  return [];
}

async function collectDroppedTasks(dt) {
  if (!dt) return [];
  const items = Array.from(dt.items || []);
  if (items.length && items[0].webkitGetAsEntry) {
    const out = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        if (entry.isFile) {
          const file = item.getAsFile();
          if (file) out.push({ file, relativePath: file.name, isDirectory: false });
        } else if (entry.isDirectory) {
          const files = await traverseEntry(entry, '');
          for (const f of files) out.push({ ...f, isDirectory: true });
        }
      } else {
        const file = item.getAsFile();
        if (file) out.push({ file, relativePath: file.name, isDirectory: false });
      }
    }
    // normalize via collectSelectedFiles-like filtering/lowercasing
    const bin = out.filter(t => /\.bin$/i.test(t.file.name));
    if (!bin.length) return [];
    if (!state.lowercaseOnUpload) return bin.map(t => ({ file: t.file, relativePath: t.relativePath }));
    return bin.map(t => ({ file: t.file, relativePath: String(t.relativePath||'').split('/').map(s=>s.toLowerCase()).join('/') }));
  }
  return collectSelectedFiles(dt.files, { isDirectory: false });
}

function setupDragDrop() {
  const target = ui.dropZone || ui.browserPanel;
  if (!target) return;
  let depth = 0;
  const show = (on) => { if (ui.dropHint) ui.dropHint.classList.toggle('hidden', !on); target.classList.toggle('drag-over', !!on); };
  ['dragenter','dragover'].forEach(ev => target.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!state.client || !state.client.connected || state.busy) return;
    if (ev==='dragenter') depth++;
    show(true);
  }));
  ['dragleave','drop'].forEach(ev => target.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    if (ev==='dragleave') depth = Math.max(0, depth-1);
    if (ev==='drop' || depth===0) { depth=0; show(false); }
  }));
  target.addEventListener('drop', async (e) => {
    if (!state.client || !state.client.connected || state.busy) return;
    try {
      const tasks = await collectDroppedTasks(e.dataTransfer);
      if (!tasks.length) { setStatus(t('status.folderNoBin'), 'warn'); return; }
      const title = document.documentElement.lang === 'en'
        ? `Upload ${tasks.length} file(s)`
        : `Subida de ${tasks.length} archivo(s)`;
      await uploadTasks(tasks, title);
    } catch (err) {
      log(t('msg.errorSelectingFolders', { msg: err.message }), 'error');
      setStatus(t('msg.errorSelectingFolders', { msg: err.message }), 'error');
    }
  });
}

setupDragDrop();



function initDevicePanelAccordion() {
  const panel = document.getElementById('devicePanel');
  const toggle = document.getElementById('devicePanelToggle');
  const content = document.getElementById('devicePanelContent');
  if (!panel || !toggle || !content) return;
  const mq = window.matchMedia('(max-width: 900px)');
  const applyMode = () => {
    const mobile = mq.matches;
    if (!mobile) {
      panel.classList.remove('collapsed');
      toggle.setAttribute('aria-expanded', 'true');
    } else {
      // keep current state on resize; ensure aria matches
      toggle.setAttribute('aria-expanded', panel.classList.contains('collapsed') ? 'false' : 'true');
    }
  };
  toggle.addEventListener('click', () => {
    if (!mq.matches) return;
    const collapsed = panel.classList.toggle('collapsed');
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  });
  if (mq.addEventListener) mq.addEventListener('change', applyMode);
  else if (mq.addListener) mq.addListener(applyMode);
  applyMode();
}
initDevicePanelAccordion();

function initLocalOnlyLinks() {
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const driveItem = document.getElementById('localDriveSourceItem');
  if (driveItem) driveItem.style.display = isLocal ? '' : 'none';
}

// Init
initLocalOnlyLinks();
initBluetoothSupport();
renderPathbar();
renderFiles();
renderDrive();
setStatus(t('status.initial'), 'info');
log(t('log.appStarted'));
