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
} from './services/device.js';

setBrowserHandlers({ onRename, onDelete, onMovePick });

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
