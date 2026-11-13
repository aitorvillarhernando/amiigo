import { state, ui } from '../state.js';
import { buildSegmentsForTask, computePathValidation, joinRemotePath, applySegmentRenamesToTasks } from '../utils.js';

export function openPathModal(task, cwd, relPath) {
  return new Promise((resolve) => {
    const { segs, kinds } = buildSegmentsForTask({ ...task, relativePath: relPath });
    let currentSegs = [...segs];

    function render() {
      const v = computePathValidation(cwd, currentSegs, kinds);
      ui.pathModalSegments.innerHTML = '';
      currentSegs.forEach((seg, i) => {
        const row = document.createElement('div');
        row.className = 'segment-row';
        const kindLabel = kinds[i] === 'file' ? 'Archivo' : `Carpeta ${i + 1}`;
        row.innerHTML = `
          <div class="segment-label"><strong>${kindLabel}</strong><span>Segmento ${i + 1}</span></div>
          <div class="segment-field">
            <input type="text" data-idx="${i}" value="" aria-label="${kindLabel}">
            <div class="segment-hint"></div>
          </div>`;
        const input = row.querySelector('input');
        const hint = row.querySelector('.segment-hint');
        input.value = seg;
        const sh = v.segmentHints[i] || { ok: true, message: '' };
        input.classList.toggle('valid', !!sh.ok);
        input.classList.toggle('invalid', !sh.ok);
        hint.textContent = sh.message || '';
        hint.className = 'segment-hint ' + (sh.ok ? 'ok' : 'err');
        input.addEventListener('input', () => {
          currentSegs[i] = input.value;
          render();
        });
        ui.pathModalSegments.appendChild(row);
      });
      ui.pathModalDesc.textContent = `La ruta o algún nombre del elemento seleccionado no cumple los límites del dispositivo.\n\nElemento: ${relPath}`;
      ui.pathModalFeedback.textContent = v.message;
      ui.pathModalFeedback.className = 'modal-feedback ' + (v.ok ? 'ok' : 'err');
      ui.pathModalPreview.textContent = v.finalPath;
      ui.pathModalOk.disabled = !v.ok;
    }

    function cleanup(result) {
      ui.pathModal.classList.add('hidden');
      ui.pathModal.setAttribute('aria-hidden', 'true');
      ui.pathModalOk.onclick = null;
      ui.pathModalSkip.onclick = null;
      resolve(result);
    }

    ui.pathModalOk.onclick = () => cleanup({ action: 'ok', segments: currentSegs });
    ui.pathModalSkip.onclick = () => cleanup({ action: 'skip' });

    ui.pathModal.classList.remove('hidden');
    ui.pathModal.setAttribute('aria-hidden', 'false');
    render();
    const firstBad = (() => {
      const v = computePathValidation(cwd, currentSegs, kinds);
      const idx = v.segmentHints.findIndex(h => !h.ok);
      return idx >= 0 ? idx : 0;
    })();
    const focusInput = ui.pathModalSegments.querySelector(`input[data-idx="${firstBad}"]`);
    if (focusInput) { focusInput.focus(); focusInput.select(); }
  });
}

export async function resolveTasksPaths(tasks, cwd) {
  const resolved = [];
  for (const task of tasks) {
    const rel = (task.relativePath || task.file.name).replace(/\\/g, '/');
    let segInfo = buildSegmentsForTask({ relativePath: rel });
    let segs = [...segInfo.segs];
    let kinds = [...segInfo.kinds];
    let v = computePathValidation(cwd, segs, kinds);
    if (!v.ok) {
      const decision = await openPathModal(task, cwd, rel);
      if (!decision || decision.action === 'skip') {
        continue;
      }
      const baseSegs = [...segs];
      segs = decision.segments;
      v = computePathValidation(cwd, segs, kinds);
      if (!v.ok) {
        continue; // should not happen (button disabled)
      }
      for (let i = 0; i < baseSegs.length - 1; i++) {
        if (baseSegs[i] !== segs[i]) {
          applySegmentRenamesToTasks(tasks, baseSegs, segs);
        }
      }
    }
    const finalSegsNow = buildSegmentsForTask({ relativePath: task.relativePath || task.file.name }).segs;
    const finalPath = joinRemotePath(cwd, finalSegsNow);
    resolved.push({ ...task, relativePath: (task.relativePath || task.file.name).replace(/\\/g,'/'), remotePath: finalPath });
  }
  const seen = new Set();
  const unique = [];
  for (const t of resolved) {
    const p = t.remotePath;
    if (seen.has(p)) continue;
    seen.add(p);
    unique.push(t);
  }
  return unique;
}
