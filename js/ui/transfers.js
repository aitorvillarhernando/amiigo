import { ui } from '../state.js';
import { t } from '../i18n.js';

export function removeEmptyTransferNote() {
  const empty = ui.transferList.querySelector('.empty');
  if (empty) empty.remove();
}

export function createTransferGroup(title) {
  removeEmptyTransferNote();
  const group = document.createElement('div');
  group.className = 'transfer-group active';
  group.dataset.status = 'active';
  group.innerHTML = `
    <div class="transfer-group-header">
      <div class="transfer-top">
        <div class="transfer-name"></div>
        <div class="transfer-state t-run"></div>
      </div>
      <div class="progress"><div class="progress-bar overall-bar" style="width:0%"></div></div>
      <div class="transfer-meta overall-meta"></div>
    </div>
    <div class="transfer-files"></div>`;
  group.querySelector('.transfer-name').textContent = title;
  group.querySelector('.transfer-group-header .transfer-state').textContent = t('transfer.queued');
  ui.transferList.prepend(group);
  const overallState = group.querySelector('.transfer-group-header .transfer-state');
  const overallBar = group.querySelector('.overall-bar');
  const overallMeta = group.querySelector('.overall-meta');
  const filesWrap = group.querySelector('.transfer-files');

  const api = {
    setProgress(pct, meta = '') {
      overallBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
      overallMeta.textContent = meta;
    },
    setState(text, cls = 't-run') {
      overallState.textContent = text;
      overallState.className = `transfer-state ${cls}`;
      if (cls === 't-run') {
        group.dataset.status = 'active';
        group.classList.add('active');
      } else {
        group.dataset.status = 'done';
        group.classList.remove('active');
      }
    },
    createFileItem(name) {
      const item = document.createElement('div');
      item.className = 'transfer-file-item';
      item.innerHTML = `
        <div class="transfer-top">
          <div class="transfer-name file-name"></div>
          <div class="transfer-state file-state t-run"></div>
        </div>
        <div class="progress progress-sm"><div class="progress-bar file-bar" style="width:0%"></div></div>
        <div class="transfer-meta file-meta"></div>`;
      item.querySelector('.file-name').textContent = name;
      item.querySelector('.file-state').textContent = t('transfer.queued');
      filesWrap.appendChild(item);
      const st = item.querySelector('.file-state');
      const bar = item.querySelector('.file-bar');
      const meta = item.querySelector('.file-meta');
      return {
        setProgress(pct, m = '') { bar.style.width = Math.max(0, Math.min(100, pct)) + '%'; meta.textContent = m; },
        setState(text, cls = 't-run') { st.textContent = text; st.className = `transfer-state file-state ${cls}`; }
      };
    }
  };
  return api;
}

export function clearCompletedTransfers() {
  const groups = ui.transferList.querySelectorAll('.transfer-group');
  groups.forEach(g => {
    if (g.dataset.status !== 'active') { g.remove(); }
  });
  const hasActive = ui.transferList.querySelector('.transfer-group[data-status="active"]');
  const hasAnything = ui.transferList.querySelector('.transfer-group');
  if (!hasAnything && !hasActive) {
    ui.transferList.innerHTML = `<div class="empty muted">${t('transfers.empty')}</div>`;
  }
}

export function createTransferItem(name) {
  removeEmptyTransferNote();
  const div = document.createElement('div');
  div.className = 'transfer-item';
  div.innerHTML = `
    <div class="transfer-top">
      <div class="transfer-name"></div>
      <div class="transfer-state t-run"></div>
    </div>
    <div class="progress"><div class="progress-bar" style="width:0%"></div></div>
    <div class="transfer-meta"></div>`;
  div.querySelector('.transfer-name').textContent = name;
  div.querySelector('.transfer-state').textContent = t('transfer.queued');
  ui.transferList.prepend(div);
  return {
    setProgress(pct, meta = '') {
      div.querySelector('.progress-bar').style.width = Math.max(0, Math.min(100, pct)) + '%';
      div.querySelector('.transfer-meta').textContent = meta;
    },
    setState(text, cls = 't-run') {
      const st = div.querySelector('.transfer-state');
      st.textContent = text;
      st.className = `transfer-state ${cls}`;
    }
  };
}
