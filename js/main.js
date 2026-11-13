import { state, ui } from './state.js';
import { getParentPath } from './ble/pixl-client.js';
import { log, setStatus } from './ui/status.js';
import { setBusy } from './ui/busy.js';
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

ui.connectBtn.addEventListener('click', toggleConnect);
ui.refreshBtn.addEventListener('click', () => refreshDriveAndList(state.cwd));
ui.upBtn.addEventListener('click', () => {
  if (!state.cwd || !state.drive) return;
  const root = state.drive.label + ':/';
  if (state.cwd === root) return;
  navigateToUp();
});

function navigateToUp() {
  if (state.busy) return;
  refreshDriveAndList(getParentPath(state.cwd));
}

ui.mkdirBtn.addEventListener('click', createFolder);

ui.fileInput.addEventListener('change', async (e) => {
  if (!state.client || !state.client.connected || state.busy) return;
  const tasks = await collectSelectedFiles(e.target.files, { isDirectory: false });
  e.target.value = '';
  if (!tasks.length) { setStatus('No se seleccionaron archivos .bin.', 'warn'); return; }
  await uploadTasks(tasks, `Subida de ${tasks.length} archivo(s)`);
});

ui.dirInput.addEventListener('change', async (e) => {
  if (!state.client || !state.client.connected || state.busy) return;
  const tasks = await collectSelectedFiles(e.target.files, { isDirectory: true });
  e.target.value = '';
  if (!tasks.length) { setStatus('La carpeta no contiene archivos .bin.', 'warn'); return; }
  const dirName = (tasks[0].relativePath || '').split('/')[0] || 'carpeta';
  await uploadTasks(tasks, `Carpeta: ${dirName} (${tasks.length} archivo(s) .bin)`);
});

ui.uploadMultiDirBtn.addEventListener('click', async () => {
  if (!state.client || !state.client.connected || state.busy) return;
  try {
    const tasks = await pickMultipleDirectories();
    if (tasks == null) { setStatus('Tu navegador no soporta selección de varias carpetas. Usa "Subir carpeta".', 'warn'); return; }
    if (!tasks.length) { setStatus('No se seleccionaron carpetas o no contienen archivos .bin.', 'warn'); return; }
    const rootNames = Array.from(new Set(tasks.map(t => (t.relativePath || '').split('/')[0]).filter(Boolean)));
    const label = rootNames.length <= 3 ? rootNames.join(', ') : `${rootNames.slice(0,3).join(', ')} (+${rootNames.length - 3})`;
    await uploadTasks(tasks, `Varias carpetas: ${label} (${tasks.length} archivo(s) .bin)`);
  } catch (err) {
    log(`Error seleccionando carpetas: ${err.message}`, 'error');
    setStatus(`Error seleccionando carpetas: ${err.message}`, 'error');
  }
});

ui.clearTransfersBtn.addEventListener('click', clearCompletedTransfers);
ui.pasteMoveBtn.addEventListener('click', pasteMove);
ui.cancelMoveBtn.addEventListener('click', cancelMove);
ui.dfuBtn.addEventListener('click', updateFirmwareFlow);

// Init
initBluetoothSupport();
renderPathbar();
renderFiles();
renderDrive();
setStatus('Listo. Conecta tu dispositivo en modo transferencia BLE.', 'info');
log('Aplicación iniciada. Usa un navegador con Web Bluetooth.');
