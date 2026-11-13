import { ui } from '../state.js';
import { buildSegmentsForTask, computePathValidation, joinRemotePath, applySegmentRenamesToTasks } from '../utils.js';
import { t } from '../i18n.js';

function hintText(sh) {
  if (!sh) return '';
  if (sh.key === 'modal.pathTooLong') {
    const kindLabel = sh.params.kind === 'file' ? t('modal.pathKindFile') : t('modal.pathKindDir');
    return t('modal.pathTooLong', { kind: kindLabel, n: sh.params.n, max: sh.params.max });
  }
  return t(sh.key, sh.params || {});
}

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
        const kindLabel = kinds[i] === 'file' ? t('modal.segmentFile') : t('modal.segmentDir', { n: i + 1 });
        row.innerHTML = `
          <div class="segment-label"><strong></strong><span></span></div>
          <div class="segment-field">
            <input type="text" data-idx="${i}" value="" aria-label="">
            <div class="segment-hint"></div>
          </div>`;
        row.querySelector('.segment-label strong').textContent = kindLabel;
        row.querySelector('.segment-label span').textContent = t('modal.segmentN', { n: i + 1 });
        const input = row.querySelector('input');
        input.setAttribute('aria-label', kindLabel);
        const hint = row.querySelector('.segment-hint');
        input.value = seg;
        const sh = v.segmentHints[i] || { ok: true, key: 'modal.nameOk', params: { n: 0 } };
        input.classList.toggle('valid', !!sh.ok);
        input.classList.toggle('invalid', !sh.ok);
        hint.textContent = hintText(sh);
        hint.className = 'segment-hint ' + (sh.ok ? 'ok' : 'err');
        input.addEventListener('input', () => {
          currentSegs[i] = input.value;
          render();
        });
        ui.pathModalSegments.appendChild(row);
      });
      ui.pathModalDesc.textContent = t('modal.desc', { item: relPath });
      ui.pathModalFeedback.textContent = v.ok ? t('modal.okMsg') : t('modal.errMsg');
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
