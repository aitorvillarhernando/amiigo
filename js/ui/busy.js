import { state, ui } from '../state.js';
import { setStatus, setControlsConnected } from './status.js';
import { renderFiles, renderPathbar } from './browser.js';

export function setBusy(busy, label = '') {
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
