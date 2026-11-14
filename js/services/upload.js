import { state, ui } from '../state.js';
import { formatBytes, isSafeFileName } from '../utils.js';
import { getBaseName, getParentPath } from '../ble/pixl-client.js';
import { t } from '../i18n.js';
import { setStatus, log } from '../ui/status.js';
import { setBusy } from '../ui/busy.js';
import { createTransferGroup } from '../ui/transfers.js';
import { resolveTasksPaths } from '../ui/modal.js';
import { refreshDriveAndList } from '../ui/browser.js';

function maybeLowercasePath(relPath) {
  if (!state.lowercaseOnUpload) return relPath;
  return String(relPath || '').split('/').map(seg => seg.toLowerCase()).join('/');
}

export async function collectSelectedFiles(fileList, { isDirectory = false } = {}) {
  const out = [];
  for (const f of Array.from(fileList || [])) {
    const relRaw = isDirectory ? (f.webkitRelativePath || f.name) : f.name;
    if (!/\.bin$/i.test(f.name)) continue;
    out.push({ file: f, relativePath: maybeLowercasePath(relRaw) });
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
    addMore = confirm(t('confirm.addMoreFolders'));
  }
  if (!dirs.length) return [];

  async function walkDir(handle, prefix) {
    const files = [];
    for await (const [name, entry] of handle.entries()) {
      if (!isSafeFileName(name)) continue;
      const rel = maybeLowercasePath(prefix ? `${prefix}/${name}` : name);
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
    const prefix = maybeLowercasePath(d.name || 'carpeta');
    const files = await walkDir(d, prefix);
    all.push(...files);
  }
  return all;
}

export async function uploadTasks(tasks, title) {
  if (!tasks.length) return;
  setBusy(true, t('status.checkingPaths'));

  const cwd = state.cwd || (state.drive ? state.drive.label + ':/' : 'E:/');
  try {
    const resolved = await resolveTasksPaths(tasks, cwd);
    if (!resolved.length) {
      setStatus(t('status.noFilesToUpload'), 'warn');
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
  setStatus(t('status.uploading'), 'info');
  state.abortController = new AbortController();
  const group = createTransferGroup(title);
  group.setState(t('transfer.uploading'), 't-run');

  let done = 0, failed = 0, totalBytes = 0, sentBytes = 0;
  for (const task of tasks) totalBytes += task.file.size;

  try {
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const file = task.file;
      const remotePath = task.remotePath;
      const relLabel = task.relativePath || file.name;

      const item = group.createFileItem(relLabel);
      item.setState(t('transfer.uploading'), 't-run');
      log(t('log.uploading', { rel: relLabel, remote: remotePath }));

      try {
        const parentDir = getParentPath(remotePath);
        if (parentDir) await state.client.ensureFolder(parentDir);

        await state.client.uploadFile(remotePath, file, (written, total) => {
          const pctFile = total ? (written / total) * 100 : 100;
          item.setProgress(pctFile, `${formatBytes(written)} / ${formatBytes(total || written)}`);
          const overall = totalBytes ? ((sentBytes + written) / totalBytes) * 100 : ((i) / tasks.length) * 100;
          group.setProgress(overall, t('transfer.progressOverall', { done, total: tasks.length, sent: formatBytes(sentBytes + written), totalBytes: formatBytes(totalBytes) }));
        }, state.abortController.signal);

        sentBytes += file.size;
        item.setProgress(100, t('transfer.verifying'));

        const name = getBaseName(remotePath);
        const list = await state.client.readFolder(parentDir);
        if (!list.ok) {
          const msg = document.documentElement.lang === 'en'
            ? `Uploaded, but could not verify: ${list.error}`
            : `Subido, pero no se pudo verificar: ${list.error}`;
          throw new Error(msg);
        }
        const found = (list.data || []).find(e => (e.type === 'FILE' || e.type === 'file') && e.name === name);
        if (!found) {
          throw new Error(document.documentElement.lang === 'en' ? 'Uploaded, but the file does not appear on the device.' : 'Subido, pero el archivo no aparece en el dispositivo.');
        }
        if (typeof file.size === 'number' && found.size !== file.size) {
          throw new Error(document.documentElement.lang === 'en'
            ? `Verification failed: local size ${file.size} B, remote ${found.size} B.`
            : `Verificación fallida: tamaño local ${file.size} B, remoto ${found.size} B.`);
        }

        item.setProgress(100, t('transfer.verifiedMeta', { size: formatBytes(file.size) }));
        item.setState(t('transfer.verified'), 't-ok');
        log(t('log.verified', { path: remotePath, size: file.size }), 'info');
        done++;
      } catch (err) {
        failed++;
        item.setState(t('transfer.error'), 't-err');
        item.setProgress(100, err.message);
        log(t('log.failUpload', { rel: relLabel, msg: err.message }), 'error');
      }

      const overall = totalBytes ? (sentBytes / totalBytes) * 100 : ((i + 1) / tasks.length) * 100;
      group.setProgress(overall, t('transfer.progressOverallFail', { done, total: tasks.length, fail: failed, sent: formatBytes(sentBytes), totalBytes: formatBytes(totalBytes) }));
    }

    if (failed === 0) {
      group.setState(t('transfer.completed'), 't-ok');
      setStatus(t('status.uploadComplete', { n: done }), 'success');
    } else if (done > 0) {
      group.setState(t('transfer.partial', { ok: done, fail: failed }), 't-warn');
      setStatus(t('status.uploadPartial', { ok: done, fail: failed }), 'warn');
    } else {
      group.setState(t('transfer.failed'), 't-err');
      setStatus(t('status.uploadFailed'), 'error');
    }

    await refreshDriveAndList(cwd);
  } catch (err) {
    group.setState(t('transfer.interrupted'), 't-err');
    log(t('log.uploadInterrupted', { msg: err.message }), 'error');
    setStatus(t('status.uploadInterrupted', { msg: err.message }), 'error');
  }
}
