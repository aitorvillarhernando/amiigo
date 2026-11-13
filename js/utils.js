import { utf8Length } from './ble/pixl-client.js';
import { MAX_FILE_NAME_BYTES, MAX_FILE_PATH_BYTES, MAX_FOLDER_PATH_BYTES } from './constants.js';

export function formatBytes(bytes) {
  if (bytes == null || isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  const digits = i === 0 ? 0 : (n < 10 ? 2 : 1);
  return `${n.toFixed(digits)} ${units[i]}`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export function escapeAttr(s) { return escapeHtml(s); }

export function isValidName(name) {
  if (!name || name === '.' || name === '..') return false;
  if (/[\\/]/.test(name)) return false;
  return true;
}

export function pathNameIssues(name, kind = 'file') {
  if (!isValidName(name)) return 'Nombre vacío o con caracteres no permitidos.';
  const nb = utf8Length(name);
  if (nb > MAX_FILE_NAME_BYTES) return `Nombre demasiado largo (${nb}/${MAX_FILE_NAME_BYTES} bytes UTF-8).`;
  return null;
}

export function isSafeFileName(name) {
  return name && name !== '.' && name !== '..' && !/[\\/]/.test(name);
}

export function buildSegmentsForTask(task) {
  const rel = (task.relativePath || task.file.name).replace(/\\/g, '/').replace(/^\/+/, '');
  const segs = rel.split('/').filter(Boolean);
  const kinds = segs.map((_, i) => i === segs.length - 1 ? 'file' : 'dir');
  return { segs, kinds };
}

export function joinRemotePath(cwd, segments) {
  const base = (cwd || '').endsWith('/') ? (cwd || '').slice(0, -1) : (cwd || '');
  return base + '/' + segments.join('/');
}

export function computePathValidation(cwd, segments, kinds) {
  const safeCwd = cwd || '';
  const base = safeCwd.endsWith('/') ? safeCwd.slice(0, -1) : safeCwd;
  const segmentHints = segments.map(() => ({ ok: true, message: '' }));
  let ok = true;
  let message = 'Ruta correcta.';

  for (let i = 0; i < segments.length; i++) {
    const name = segments[i];
    const kind = kinds[i];
    const ni = pathNameIssues(name, kind);
    if (ni) {
      segmentHints[i] = { ok: false, message: ni };
      ok = false;
    } else {
      segmentHints[i] = { ok: true, message: `Correcto (${utf8Length(name)} B nombre)` };
    }
  }

  const fullPath = base + '/' + segments.join('/');
  for (let i = 0; i < segments.length; i++) {
    const kind = kinds[i];
    const partial = base + '/' + segments.slice(0, i + 1).join('/');
    const limit = kind === 'file' ? MAX_FILE_PATH_BYTES : MAX_FOLDER_PATH_BYTES;
    if (utf8Length(partial) > limit) {
      const bytes = utf8Length(partial);
      segmentHints[i] = { ok: false, message: `Ruta ${kind === 'file' ? 'de archivo' : 'de carpeta'} demasiado larga (${bytes}/${limit} bytes).` };
      ok = false;
    }
  }

  if (ok) message = 'Todos los segmentos y la ruta completa son válidos.';
  else message = 'Corrige los segmentos marcados en rojo para continuar.';

  return { ok, message, segmentHints, finalPath: fullPath };
}

export function applySegmentRenamesToTasks(tasks, baseSegs, newSegs) {
  if (!Array.isArray(tasks) || !tasks.length) return;
  for (let i = 0; i < Math.min(baseSegs.length, newSegs.length); i++) {
    if (baseSegs[i] === newSegs[i]) continue;
    if (i === baseSegs.length - 1) continue; // only directory segments are shared across tasks

    const oldRelPrefix = baseSegs.slice(0, i + 1).join('/');
    const newRelPrefix = newSegs.slice(0, i + 1).join('/');

    for (const t of tasks) {
      const rel = (t.relativePath || t.file?.name || '').replace(/\\/g, '/').replace(/^\/+/, '');
      if (rel === oldRelPrefix) {
        t.relativePath = newRelPrefix;
        if (t.remotePath) t.remotePath = undefined; // force recompute later if present
      } else if (rel.startsWith(oldRelPrefix + '/')) {
        t.relativePath = newRelPrefix + rel.slice(oldRelPrefix.length);
        if (t.remotePath) t.remotePath = undefined;
      } else if (t.remotePath) {
        // fallback: if remotePath exists, update it too
        const rp = t.remotePath;
        const oldTail = '/' + oldRelPrefix;
        const newTail = '/' + newRelPrefix;
        if (rp.endsWith(oldTail)) {
          t.remotePath = rp.slice(0, -oldTail.length) + newTail;
        } else if (rp.includes(oldTail + '/')) {
          t.remotePath = rp.split(oldTail + '/').join(newTail + '/');
        }
      }
    }
  }
}
