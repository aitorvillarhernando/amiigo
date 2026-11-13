import { state, ui } from '../state.js';
import { t } from '../i18n.js';

export function log(msg, level = 'info') {
  const ts = new Date().toLocaleTimeString();
  const prefix = level === 'error' ? '[ERR]' : level === 'warn' ? '[WARN]' : '[INFO]';
  ui.log.textContent += `${ts} ${prefix} ${msg}\n`;
  ui.log.scrollTop = ui.log.scrollHeight;
  if (level === 'error') console.error(msg);
  else if (level === 'warn') console.warn(msg);
  else console.log(msg);
}

export function setStatus(text, kind = 'info') {
  if (ui.statusText) ui.statusText.textContent = text;
  else ui.statusBar.textContent = text;
  ui.statusBar.className = `status status-${kind}`;
  if (ui.statusSpinner && !state.busy) ui.statusSpinner.classList.add('hidden');
}

export function setControlsConnected(connected) {
  const on = !!connected;
  ui.connectBtn.textContent = on ? t('header.disconnect') : t('header.connect');
  ui.refreshBtn.disabled = !on || state.busy;
  ui.dfuBtn.disabled = !on || state.busy;
  ui.upBtn.disabled = !on || state.busy;
  ui.mkdirBtn.disabled = !on || state.busy;
  ui.fileInput.disabled = !on || state.busy;
  ui.dirInput.disabled = !on || state.busy;
  ui.uploadMultiDirBtn.disabled = !on || state.busy || !(window.showDirectoryPicker);
  ui.devStatus.textContent = on ? t('device.connected') : t('device.disconnected');
  if (!on) {
    ui.devName.textContent = '—';
    ui.devVersion.textContent = '—';
    ui.devAddr.textContent = '—';
    ui.driveLabel.textContent = '—';
    ui.driveMeta.textContent = '—';
    ui.driveBar.style.width = '0%';
  }
  updateMoveBar();
}

export function updateMoveBar() {
  if (!ui.moveBar) return;
  if (state.clipboard) {
    ui.moveName.textContent = state.clipboard.path;
    ui.moveBar.classList.remove('hidden');
    const canPaste = !!(state.client && state.client.connected) && !state.busy;
    ui.pasteMoveBtn.disabled = !canPaste;
    ui.cancelMoveBtn.disabled = state.busy;
  } else {
    ui.moveBar.classList.add('hidden');
    ui.moveName.textContent = '';
  }
}
