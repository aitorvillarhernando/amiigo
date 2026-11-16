import { PixlClient, isWebBluetoothSupported } from '../ble/pixl-client.js';
import { state, ui } from '../state.js';
import { t } from '../i18n.js';
import { log, setStatus, setControlsConnected } from '../ui/status.js';
import { setBusy } from '../ui/busy.js';
import { renderDrive, renderFiles, renderPathbar, refreshDriveAndList } from '../ui/browser.js';
import { getParentPath, utf8Length } from '../ble/pixl-client.js';
import { MAX_FILE_NAME_BYTES, MAX_FILE_PATH_BYTES, MAX_FOLDER_PATH_BYTES } from '../constants.js';
import { isValidName } from '../utils.js';

export function initBluetoothSupport(refreshOnly = false) {
  if (isWebBluetoothSupported()) {
    ui.supportBadge.textContent = t('badge.available');
    ui.supportBadge.className = 'badge badge-ok';
  } else {
    ui.supportBadge.textContent = t('badge.unavailable');
    ui.supportBadge.className = 'badge badge-bad';
    ui.connectBtn.disabled = true;
    if (!refreshOnly) setStatus(t('badge.unavailable') + '. ' + (document.documentElement.lang === 'en' ? 'Use Chrome or Edge on desktop/Android.' : 'Usa Chrome o Edge en escritorio/Android.'), 'error');
  }
  if (!window.showDirectoryPicker) {
    ui.uploadMultiDirBtn.title = document.documentElement.lang === 'en'
      ? 'Your browser does not support selecting multiple folders; use individual "Upload folder".'
      : 'Tu navegador no soporta selección de varias carpetas; usa "Subir carpeta" individual.';
  } else {
    ui.uploadMultiDirBtn.title = t('browser.uploadMultiDirTitle');
  }
}

export async function toggleConnect() {
  if (state.busy) return;
  if (state.client && state.client.connected) {
    state.client.disconnect();
    setStatus(t('status.disconnected'), 'info');
    setControlsConnected(false);
    state.entries = [];
    state.drive = null;
    state.cwd = '';
    state.clipboard = null;
    renderPathbar();
    renderFiles();
    renderDrive();
    return;
  }
  try {
    setStatus(t('status.requesting'), 'info');
    const client = new PixlClient({ log });
    client.onDisconnect = () => {
      log(t('log.disconnected'), 'warn');
      setStatus(t('status.deviceDisconnected'), 'warn');
      state.clipboard = null;
      setControlsConnected(false);
      renderFiles();
    };
    await client.connect();
    state.client = client;
    ui.devName.textContent = client.name || '—';
    setStatus(t('status.readingInfo'), 'info');
    try {
      const ver = await client.getVersion();
      if (ver.ok) {
        ui.devVersion.textContent = ver.data.version || '—';
        ui.devAddr.textContent = ver.data.bleAddress || '—';
      } else {
        log(t('log.versionError', { msg: ver.error }), 'error');
      }
    } catch (ve) {
      log(t('log.versionError', { msg: ve.message }), 'error');
    }
    setControlsConnected(true);
    setStatus(t('status.connectedLoading'), 'success');
    await refreshDriveAndList();
    setStatus(t('status.ready'), 'success');
  } catch (err) {
    log(t('log.connectionFailed', { msg: err.message }), 'error');
    setStatus(t('status.connectFailed', { msg: err.message }), 'error');
    setControlsConnected(false);
  }
}

export async function createFolder() {
  if (!state.client || !state.client.connected || state.busy) return;
  const name = prompt(t('prompt.newFolder'));
  if (!name) return;
  if (/[\\/]/.test(name)) { alert(t('alert.invalidName')); return; }
  const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
  const path = base + name;
  if (utf8Length(name) > MAX_FILE_NAME_BYTES) { alert(t('alert.nameTooLong', { max: MAX_FILE_NAME_BYTES })); return; }
  if (utf8Length(path) > MAX_FOLDER_PATH_BYTES) { alert(t('alert.folderPathTooLong', { max: MAX_FOLDER_PATH_BYTES })); return; }

  let ok = false; let errMsg = '';
  try {
    setBusy(true, t('busy.creatingFolder', { name }));
    const res = await state.client.createFolder(path);
    if (!res.ok) throw new Error(res.error);
    log(t('log.folderCreated', { path }));
    await refreshDriveAndList(state.cwd);
    ok = true;
  } catch (err) {
    errMsg = err.message;
    log(t('msg.errorCreatingFolder', { msg: err.message }), 'error');
  } finally {
    setBusy(false);
  }
  if (ok) setStatus(t('msg.folderCreated', { name }), 'success');
  else setStatus(t('msg.errorCreatingFolder', { msg: errMsg }), 'error');
}

async function renameAppearedSuccessful(dirPath, oldName, newName) {
  try {
    const list = await state.client.readFolder(dirPath);
    if (!list.ok || !Array.isArray(list.data)) return false;
    const hasNew = list.data.some(e => e.name === newName);
    const hasOld = list.data.some(e => e.name === oldName);
    return hasNew && !hasOld;
  } catch (_) {
    return false;
  }
}

export async function onRename(oldName) {
  if (state.busy) return;
  let proposed = oldName;
  for (;;) {
    const input = prompt(t('prompt.newName'), proposed);
    if (input == null) return;
    const newName = input.trim();
    if (newName === oldName) return;
    if (!isValidName(newName)) { alert(t('alert.invalidName')); proposed = newName; continue; }
    const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
    const oldPath = base + oldName;
    const newPath = base + newName;
    const isDir = state.entries.some(e => e.name === oldName && (e.type === 'dir' || e.type === 'DIR'));
    const maxPath = isDir ? MAX_FOLDER_PATH_BYTES : MAX_FILE_PATH_BYTES;
    if (utf8Length(newName) > MAX_FILE_NAME_BYTES) { alert(t('alert.nameTooLong', { max: MAX_FILE_NAME_BYTES })); proposed = newName; continue; }
    if (utf8Length(newPath) > maxPath) { alert(t('alert.pathTooLong', { max: maxPath })); proposed = newName; continue; }

    let ok = false;
    let errMsg = '';
    let verifiedDespiteError = false;
    try {
      setBusy(true, t('busy.renaming', { name: oldName }));
      const res = await state.client.renamePath(oldPath, newPath);
      if (!res.ok) throw new Error(res.error);
      log(t('log.renamed', { old: oldPath, new: newPath }));
      await refreshDriveAndList(state.cwd);
      ok = true;
    } catch (e) {
      errMsg = e.message;
      log(t('msg.errorRenaming', { msg: e.message }), 'error');
      // Some devices return a command error even when the rename was applied; verify actual state.
      if (await renameAppearedSuccessful(state.cwd, oldName, newName)) {
        verifiedDespiteError = true;
        ok = true;
        log(t('log.renameVerifiedWarn', { old: oldPath, new: newPath }), 'warn');
        await refreshDriveAndList(state.cwd);
      } else {
        alert(t('alert.renameFailed', { msg: e.message }));
      }
    } finally {
      setBusy(false);
    }
    if (ok) {
      if (verifiedDespiteError) setStatus(t('msg.renamedOkWarn', { name: newName }), 'success');
      else setStatus(t('msg.renamedOk', { name: newName }), 'success');
    } else {
      setStatus(t('msg.errorRenaming', { msg: errMsg }), 'error');
    }
    return;
  }
}

export async function onDelete(name, type) {
  if (state.busy) return;
  const isDir = type === 'dir';
  if (!confirm(isDir ? t('confirm.deleteFolder', { name }) : t('confirm.deleteFile', { name }))) return;
  const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
  const path = base + name;
  let ok = false; let errMsg = '';
  try {
    setBusy(true, t('busy.deleting', { name }));
    const res = await state.client.removePath(path);
    if (!res.ok) throw new Error(res.error);
    log(t('log.deleted', { path }));
    await refreshDriveAndList(state.cwd);
    ok = true;
  } catch (err) {
    errMsg = err.message;
    log(t('msg.errorDeleting', { msg: err.message }), 'error');
  } finally {
    setBusy(false);
  }
  if (ok) setStatus(t('msg.deleted', { name }), 'success');
  else setStatus(t('msg.errorDeleting', { msg: errMsg }), 'error');
}

export function onMovePick(name, type) {
  if (state.busy) return;
  const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
  const path = base + name;
  state.clipboard = { path, name, type };
  log(t('log.preparedMove', { path }));
  setStatus(t('status.movePrepared'), 'info');
  renderPathbar();
  setControlsConnected(!!(state.client && state.client.connected));
}

export async function pasteMove() {
  if (!state.clipboard || !state.client || !state.client.connected || state.busy) return;
  const src = state.clipboard.path;
  const srcDir = getParentPath(src);
  const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
  const dest = base + state.clipboard.name;
  if (dest === src) { setStatus(t('status.sameSrcDest'), 'warn'); return; }
  if (state.clipboard.type === 'dir' && (dest + '/').startsWith(src.endsWith('/') ? src : src + '/')) {
    alert(t('alert.moveIntoSelf'));
    return;
  }
  const maxPath = state.clipboard.type === 'dir' ? MAX_FOLDER_PATH_BYTES : MAX_FILE_PATH_BYTES;
  if (utf8Length(dest) > maxPath) { alert(t('alert.destPathTooLong', { max: maxPath })); return; }

  const movingName = state.clipboard.name;
  let ok = false; let errMsg = '';
  let verifiedDespiteError = false;
  try {
    setBusy(true, t('busy.moving', { name: movingName }));
    const res = await state.client.renamePath(src, dest);
    if (!res.ok) throw new Error(res.error);
    log(t('log.moved', { old: src, new: dest }));
    state.clipboard = null;
    await refreshDriveAndList(state.cwd);
    ok = true;
  } catch (err) {
    errMsg = err.message;
    log(t('msg.errorMoving', { msg: err.message }), 'error');
    try {
      const destList = await state.client.readFolder(state.cwd);
      const hasDest = destList.ok && (destList.data || []).some(e => e.name === movingName);
      let srcGone = true;
      if (srcDir === state.cwd) {
        srcGone = !hasDest ? false : true;
      } else {
        const srcList = await state.client.readFolder(srcDir);
        srcGone = srcList.ok ? !(srcList.data || []).some(e => e.name === movingName) : false;
      }
      if (hasDest && srcGone) {
        verifiedDespiteError = true;
        ok = true;
        state.clipboard = null;
        log(t('log.moveVerifiedWarn', { src, dest }), 'warn');
        await refreshDriveAndList(state.cwd);
      }
    } catch (_) { /* ignore verification errors */ }
  } finally {
    setBusy(false);
  }
  if (ok) {
    if (verifiedDespiteError) setStatus(t('msg.movedOkWarn', { name: movingName }), 'success');
    else setStatus(t('msg.movedOk', { name: movingName }), 'success');
  } else {
    setStatus(t('msg.errorMoving', { msg: errMsg }), 'error');
  }
}

export function cancelMove() {
  state.clipboard = null;
  setControlsConnected(!!(state.client && state.client.connected));
  setStatus(t('status.moveCancelled'), 'info');
}

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

export async function updateFirmwareFlow() {
  if (!state.client || !state.client.connected || state.busy) return;

  const currentVer = ui.devVersion.textContent && ui.devVersion.textContent !== '—' ? ui.devVersion.textContent : (document.documentElement.lang === 'en' ? 'unknown' : 'desconocida');
  setBusy(true, t('busy.checkingFw'));
  const latest = await fetchLatestPixlRelease();
  setBusy(false);
  if (state.client?.connected) setStatus(t('status.ready'), 'info');

  const latestLine = latest && latest.tag ? t('dfu.latestKnown', { tag: latest.tag }) : t('dfu.latestUnknown');
  const msg = t('dfu.confirm1', { current: currentVer, latestLine });

  if (!confirm(msg)) return;

  try {
    setBusy(true, t('busy.sendingDfu'));
    const res = await state.client.enterDfu();
    setBusy(false);
    if (res.ok) {
      setStatus(t('status.dfuReady'), 'warn');
      log(t('log.dfuSent'));
      const url = (latest && latest.url) ? latest.url : 'https://github.com/solosky/pixl.js/releases';
      const openTool = confirm(t('dfu.confirm2', { url }));
      if (openTool) {
        window.open('https://thegecko.github.io/web-bluetooth-dfu/examples/web.html', '_blank', 'noopener');
      }
    } else {
      setStatus(t('status.dfuError', { msg: res.error }), 'error');
      log(t('status.dfuErrorShort', { msg: res.error }), 'error');
    }
  } catch (err) {
    setBusy(false);
    setStatus(t('status.dfuErrorShort', { msg: err.message }), 'error');
    log(t('status.dfuErrorShort', { msg: err.message }), 'error');
  }
}


export async function downloadFile(name) {
  if (state.busy || !state.client || !state.client.connected) return;
  const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
  const path = base + name;
  let ok = false; let errMsg = '';
  try {
    setBusy(true, t('busy.downloading', { name }));
    setStatus(t('status.downloading', { name }), 'info');
    const res = await state.client.readFileData(path);
    if (!res.ok) throw new Error(res.error);
    const blob = new Blob([res.data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    log(t('msg.downloaded', { name }));
    ok = true;
  } catch (err) {
    errMsg = err.message || String(err);
    log(t('msg.errorDownloading', { msg: errMsg }), 'error');
  } finally {
    setBusy(false);
  }
  if (ok) setStatus(t('msg.downloaded', { name }), 'success');
  else setStatus(t('msg.errorDownloading', { msg: errMsg }), 'error');
}

export async function formatDriveAction() {
  if (state.busy || !state.client || !state.client.connected || !state.drive) return;
  const drive = state.drive.label ? (state.drive.label + ':/') : (state.drive.name || 'drive');
  if (!confirm(t('confirm.formatDrive', { drive }))) return;
  let ok = false; let errMsg = '';
  try {
    setBusy(true, t('busy.formatting'));
    const res = await state.client.formatDrive(state.drive.label);
    if (!res.ok) throw new Error(res.error);
    log(t('log.formatted'));
    state.clipboard = null;
    await refreshDriveAndList(state.drive.label + ':/');
    ok = true;
  } catch (err) {
    errMsg = err.message || String(err);
    log(t('msg.errorFormatting', { msg: errMsg }), 'error');
  } finally {
    setBusy(false);
  }
  if (ok) setStatus(t('msg.formatted'), 'success');
  else setStatus(t('msg.errorFormatting', { msg: errMsg }), 'error');
}


async function collectRemoteFilesRecursive(dirPath, relPrefix = '') {
  const files = [];
  const list = await state.client.readFolder(dirPath);
  if (!list.ok) throw new Error(list.error);
  const entries = list.data || [];
  for (const e of entries) {
    const isDir = e.type === 'DIR' || e.type === 'dir';
    const childRemote = dirPath.endsWith('/') ? (dirPath + e.name) : (dirPath + '/' + e.name);
    const childRel = relPrefix ? (relPrefix + '/' + e.name) : e.name;
    if (isDir) {
      const sub = await collectRemoteFilesRecursive(childRemote, childRel);
      files.push(...sub);
    } else {
      files.push({ remotePath: childRemote, relPath: childRel, size: e.size });
    }
  }
  return files;
}

export async function downloadDirectory(name) {
  if (state.busy || !state.client || !state.client.connected) return;
  if (typeof JSZip === 'undefined') {
    setStatus(t('msg.zipUnavailable'), 'error');
    return;
  }
  const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
  const dirPath = base + name;
  let ok = false; let errMsg = '';
  try {
    setBusy(true, t('busy.downloadingDir', { name }));
    setStatus(t('status.downloadingDir', { name, count: '…' }), 'info');
    const files = await collectRemoteFilesRecursive(dirPath, name);
    setStatus(t('status.downloadingDir', { name, count: files.length }), 'info');
    const zip = new JSZip();
    let i = 0;
    for (const f of files) {
      i++;
      setBusy(true, t('busy.downloadingDir', { name }) + ` (${i}/${files.length})`);
      const res = await state.client.readFileData(f.remotePath);
      if (!res.ok) throw new Error(`${f.relPath}: ${res.error}`);
      zip.file(f.relPath, res.data);
    }
    setBusy(true, t('status.zipping', { name }));
    setStatus(t('status.zipping', { name }), 'info');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    log(t('msg.downloadedDir', { name }));
    ok = true;
  } catch (err) {
    errMsg = err.message || String(err);
    log(t('msg.errorDownloadingDir', { msg: errMsg }), 'error');
  } finally {
    setBusy(false);
  }
  if (ok) setStatus(t('msg.downloadedDir', { name }), 'success');
  else setStatus(t('msg.errorDownloadingDir', { msg: errMsg }), 'error');
}
