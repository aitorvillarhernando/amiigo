import { PixlClient, isWebBluetoothSupported } from '../ble/pixl-client.js';
import { state, ui } from '../state.js';
import { log, setStatus, setControlsConnected } from '../ui/status.js';
import { setBusy } from '../ui/busy.js';
import { renderDrive, renderFiles, renderPathbar, refreshDriveAndList } from '../ui/browser.js';
import { getBaseName, getParentPath, utf8Length } from '../ble/pixl-client.js';
import { MAX_FILE_NAME_BYTES, MAX_FILE_PATH_BYTES, MAX_FOLDER_PATH_BYTES } from '../constants.js';
import { isValidName } from '../utils.js';

export function initBluetoothSupport() {
  if (isWebBluetoothSupported()) {
    ui.supportBadge.textContent = 'Web Bluetooth disponible';
    ui.supportBadge.className = 'badge badge-ok';
  } else {
    ui.supportBadge.textContent = 'Web Bluetooth no disponible';
    ui.supportBadge.className = 'badge badge-bad';
    ui.connectBtn.disabled = true;
    setStatus('Este navegador no soporta Web Bluetooth. Usa Chrome o Edge en escritorio/Android.', 'error');
  }
  if (!window.showDirectoryPicker) {
    ui.uploadMultiDirBtn.title = 'Tu navegador no soporta selección de varias carpetas; usa "Subir carpeta" individual.';
  }
}

export async function toggleConnect() {
  if (state.busy) return;
  if (state.client && state.client.connected) {
    state.client.disconnect();
    setStatus('Desconectado.', 'info');
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
    setStatus('Solicitando dispositivo Bluetooth… (selecciónalo en el diálogo del navegador)', 'info');
    const client = new PixlClient({ log });
    client.onDisconnect = () => {
      log('Desconectado del dispositivo.', 'warn');
      setStatus('Dispositivo desconectado.', 'warn');
      state.clipboard = null;
      setControlsConnected(false);
      renderFiles();
    };
    await client.connect();
    state.client = client;
    ui.devName.textContent = client.name || '—';
    setStatus('Conectado. Leyendo información…', 'info');
    try {
      const ver = await client.getVersion();
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
}

export async function createFolder() {
  if (!state.client || !state.client.connected || state.busy) return;
  const name = prompt('Nombre de la nueva carpeta:');
  if (!name) return;
  if (/[\\/]/.test(name)) { alert('Nombre inválido.'); return; }
  const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
  const path = base + name;
  if (utf8Length(name) > MAX_FILE_NAME_BYTES) { alert(`Nombre demasiado largo (máx ${MAX_FILE_NAME_BYTES} bytes).`); return; }
  if (utf8Length(path) > MAX_FOLDER_PATH_BYTES) { alert(`Ruta de carpeta demasiado larga (máx ${MAX_FOLDER_PATH_BYTES} bytes).`); return; }

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
    const input = prompt('Nuevo nombre:', proposed);
    if (input == null) return;
    const newName = input.trim();
    if (newName === oldName) return;
    if (!isValidName(newName)) { alert('Nombre inválido.'); proposed = newName; continue; }
    const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
    const oldPath = base + oldName;
    const newPath = base + newName;
    const isDir = state.entries.some(e => e.name === oldName && (e.type === 'dir' || e.type === 'DIR'));
    const maxPath = isDir ? MAX_FOLDER_PATH_BYTES : MAX_FILE_PATH_BYTES;
    if (utf8Length(newName) > MAX_FILE_NAME_BYTES) { alert(`Nombre demasiado largo (máx ${MAX_FILE_NAME_BYTES} bytes).`); proposed = newName; continue; }
    if (utf8Length(newPath) > maxPath) { alert(`Ruta demasiado larga (máx ${maxPath} bytes).`); proposed = newName; continue; }

    let ok = false;
    let errMsg = '';
    let verifiedDespiteError = false;
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
      // Some devices return a command error even when the rename was applied; verify actual state.
      if (await renameAppearedSuccessful(state.cwd, oldName, newName)) {
        verifiedDespiteError = true;
        ok = true;
        log(`Renombrado verificado en el dispositivo a pesar del error reportado: ${oldPath} -> ${newPath}`, 'warn');
        await refreshDriveAndList(state.cwd);
      } else {
        alert(`No se pudo renombrar: ${e.message}`);
      }
    } finally {
      setBusy(false);
    }
    if (ok) {
      if (verifiedDespiteError) setStatus(`Renombrado correctamente: ${newName} (el dispositivo reportó un error, pero el cambio se aplicó).`, 'success');
      else setStatus(`Renombrado correctamente: ${newName}`, 'success');
    } else {
      setStatus(`Error renombrando: ${errMsg}`, 'error');
    }
    return;
  }
}

export async function onDelete(name, type) {
  if (state.busy) return;
  const isDir = type === 'dir';
  if (!confirm(`¿Eliminar ${isDir ? 'la carpeta' : 'el archivo'} "${name}"?${isDir ? '\n(La carpeta debe estar vacía en el dispositivo.)' : ''}`)) return;
  const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
  const path = base + name;
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

export function onMovePick(name, type) {
  if (state.busy) return;
  const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
  const path = base + name;
  state.clipboard = { path, name, type };
  log(`Preparado para mover: ${path}`);
  setStatus(`Elemento preparado para mover. Navega al destino y pulsa "Mover aquí".`, 'info');
  renderPathbar(); // just to be safe
  setControlsConnected(!!(state.client && state.client.connected));
}

export async function pasteMove() {
  if (!state.clipboard || !state.client || !state.client.connected || state.busy) return;
  const src = state.clipboard.path;
  const srcDir = getParentPath(src);
  const base = state.cwd.endsWith('/') ? state.cwd : state.cwd + '/';
  const dest = base + state.clipboard.name;
  if (dest === src) { setStatus('El origen y el destino son iguales.', 'warn'); return; }
  if (state.clipboard.type === 'dir' && (dest + '/').startsWith(src.endsWith('/') ? src : src + '/')) {
    alert('No puedes mover una carpeta dentro de sí misma.');
    return;
  }
  const maxPath = state.clipboard.type === 'dir' ? MAX_FOLDER_PATH_BYTES : MAX_FILE_PATH_BYTES;
  if (utf8Length(dest) > maxPath) { alert(`La ruta de destino es demasiado larga (máx ${maxPath} bytes).`); return; }

  const movingName = state.clipboard.name;
  let ok = false; let errMsg = '';
  let verifiedDespiteError = false;
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
    // verify: destination exists in cwd and source gone from source dir (same-dir move also covered)
    try {
      const destList = await state.client.readFolder(state.cwd);
      const hasDest = destList.ok && (destList.data || []).some(e => e.name === movingName);
      let srcGone = true;
      if (srcDir === state.cwd) {
        srcGone = !hasDest ? false : true; // same dir rename/move: hasDest means replaced/renamed in place
      } else {
        const srcList = await state.client.readFolder(srcDir);
        srcGone = srcList.ok ? !(srcList.data || []).some(e => e.name === movingName) : false;
      }
      if (hasDest && srcGone) {
        verifiedDespiteError = true;
        ok = true;
        state.clipboard = null;
        log(`Movimiento verificado en el dispositivo a pesar del error reportado: ${src} -> ${dest}`, 'warn');
        await refreshDriveAndList(state.cwd);
      }
    } catch (_) { /* ignore verification errors */ }
  } finally {
    setBusy(false);
  }
  if (ok) {
    if (verifiedDespiteError) setStatus(`Movido correctamente: ${movingName} (el dispositivo reportó un error, pero el cambio se aplicó).`, 'success');
    else setStatus(`Movido correctamente: ${movingName}`, 'success');
  } else {
    setStatus(`Error al mover: ${errMsg}`, 'error');
  }
}

export function cancelMove() {
  state.clipboard = null;
  setControlsConnected(!!(state.client && state.client.connected));
  setStatus('Movimiento cancelado.', 'info');
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
}
