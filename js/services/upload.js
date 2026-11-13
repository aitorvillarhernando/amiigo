import { state, ui } from '../state.js';
import { formatBytes, isSafeFileName } from '../utils.js';
import { getBaseName, getParentPath } from '../ble/pixl-client.js';
import { setStatus, log } from '../ui/status.js';
import { setBusy } from '../ui/busy.js';
import { createTransferGroup } from '../ui/transfers.js';
import { resolveTasksPaths } from '../ui/modal.js';
import { refreshDriveAndList } from '../ui/browser.js';

export async function collectSelectedFiles(fileList, { isDirectory = false } = {}) {
  const out = [];
  for (const f of Array.from(fileList || [])) {
    const rel = isDirectory ? (f.webkitRelativePath || f.name) : f.name;
    if (!/\.bin$/i.test(f.name)) continue;
    out.push({ file: f, relativePath: rel });
  }
  return out;
}

export async function pickMultipleDirectories() {
  if (!window.showDirectoryPicker) return null;
  const dirs = [];
  let addMore = true;
  while (addMore) {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      dirs.push(dirHandle);
    } catch (err) {
      if (err && err.name === 'AbortError') {
        break;
      }
      throw err;
    }
    addMore = confirm('¿Añadir otra carpeta a la subida? Pulsa "Aceptar" para elegir otra o "Cancelar" para continuar con las seleccionadas.');
  }
  if (!dirs.length) return [];

  async function walkDir(handle, prefix) {
    const files = [];
    for await (const [name, entry] of handle.entries()) {
      if (!isSafeFileName(name)) continue;
      const rel = prefix ? `${prefix}/${name}` : name;
      if (entry.kind === 'file') {
        if (/\.bin$/i.test(name)) {
          const file = await entry.getFile();
          files.push({ file, relativePath: rel });
        }
      } else if (entry.kind === 'directory') {
        const sub = await walkDir(entry, rel);
        files.push(...sub);
      }
    }
    return files;
  }

  const all = [];
  for (const d of dirs) {
    const prefix = d.name || 'carpeta';
    const files = await walkDir(d, prefix);
    all.push(...files);
  }
  return all;
}

export async function uploadTasks(tasks, title) {
  if (!tasks.length) return;
  setBusy(true, 'Comprobando rutas antes de subir…');

  const cwd = state.cwd || (state.drive ? state.drive.label + ':/' : 'E:/');
  try {
    const resolved = await resolveTasksPaths(tasks, cwd);
    if (!resolved.length) {
      setStatus('No hay archivos válidos para subir.', 'warn');
      return;
    }
    await uploadResolvedTasks(resolved, cwd, title);
  } finally {
    state.abortController = null;
    setBusy(false);
  }
}

export async function uploadResolvedTasks(tasks, cwd, title) {
  // switch from "checking paths" busy label to upload mode (transfers show detailed progress)
  if (ui.statusSpinner) ui.statusSpinner.classList.add('hidden');
  setStatus('Subiendo archivos…', 'info');
  state.abortController = new AbortController();
  const group = createTransferGroup(title);
  group.setState('Subiendo…', 't-run');

  let done = 0, failed = 0, totalBytes = 0, sentBytes = 0;
  for (const t of tasks) totalBytes += t.file.size;

  try {
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const file = task.file;
      const remotePath = task.remotePath;
      const relLabel = task.relativePath || file.name;

      const item = group.createFileItem(relLabel);
      item.setState('Subiendo…', 't-run');
      log(`Subiendo ${relLabel} -> ${remotePath}`);

      try {
        const parentDir = getParentPath(remotePath);
        if (parentDir) await state.client.ensureFolder(parentDir);

        await state.client.uploadFile(remotePath, file, (written, total) => {
          const pctFile = total ? (written / total) * 100 : 100;
          item.setProgress(pctFile, `${formatBytes(written)} / ${formatBytes(total || written)}`);
          const overall = totalBytes ? ((sentBytes + written) / totalBytes) * 100 : ((i) / tasks.length) * 100;
          group.setProgress(overall, `${done}/${tasks.length} completados · ${formatBytes(sentBytes + written)} / ${formatBytes(totalBytes)}`);
        }, state.abortController.signal);

        sentBytes += file.size;
        item.setProgress(100, 'Verificando…');

        const name = getBaseName(remotePath);
        const list = await state.client.readFolder(parentDir);
        if (!list.ok) throw new Error(`Subido, pero no se pudo verificar: ${list.error}`);
        const found = (list.data || []).find(e => (e.type === 'FILE' || e.type === 'file') && e.name === name);
        if (!found) throw new Error('Subido, pero el archivo no aparece en el dispositivo.');
        if (typeof file.size === 'number' && found.size !== file.size) {
          throw new Error(`Verificación fallida: tamaño local ${file.size} B, remoto ${found.size} B.`);
        }

        item.setProgress(100, `OK · ${formatBytes(file.size)} verificado`);
        item.setState('Verificado', 't-ok');
        log(`Verificado ${remotePath} (${file.size} B)`, 'info');
        done++;
      } catch (err) {
        failed++;
        item.setState('Error', 't-err');
        item.setProgress(100, err.message);
        log(`Fallo en ${relLabel}: ${err.message}`, 'error');
      }

      const overall = totalBytes ? (sentBytes / totalBytes) * 100 : ((i + 1) / tasks.length) * 100;
      group.setProgress(overall, `${done}/${tasks.length} completados · ${failed} fallidos · ${formatBytes(sentBytes)} / ${formatBytes(totalBytes)}`);
    }

    if (failed === 0) {
      group.setState('Completado y verificado', 't-ok');
      setStatus(`Subida completada: ${done} archivo(s) verificados.`, 'success');
    } else if (done > 0) {
      group.setState(`Parcial: ${done} ok, ${failed} fallidos`, 't-warn');
      setStatus(`Subida parcial: ${done} verificados, ${failed} con error.`, 'warn');
    } else {
      group.setState('Fallida', 't-err');
      setStatus('La subida ha fallado.', 'error');
    }

    await refreshDriveAndList(cwd);
  } catch (err) {
    group.setState('Interrumpida', 't-err');
    log(`Subida interrumpida: ${err.message}`, 'error');
    setStatus(`Subida interrumpida: ${err.message}`, 'error');
  }
}
