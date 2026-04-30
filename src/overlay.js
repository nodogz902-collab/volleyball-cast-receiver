/**
 * Overlay renderer. Pure DOM updates from canonical state payloads.
 *
 * Match layout: prominent score top-center, set indicator top-left,
 * set-history top-right, last action bottom-left, badge bottom-right.
 * Training layout: drill label top-center, counters mid, last action
 * bottom-left, no badge.
 */

const SERVE_EMOJI = '🏐';
const TRAINING_LABEL = '🏋️ Training';
const LAST_ACTION_FADE_MS = 3000;

let lastActionTimer = null;

/**
 * Reset transient state (timers). Used by tests between cases.
 */
export function resetOverlay() {
  if (lastActionTimer) {
    clearTimeout(lastActionTimer);
    lastActionTimer = null;
  }
}

/**
 * Apply a state-push to the DOM.
 * @param {object} state canonical state payload
 */
export function update(state) {
  if (!state) return;

  if (state.isTraining || state.format === 'training') {
    document.body.classList.add('training');
    renderTraining(state);
  } else {
    document.body.classList.remove('training');
    renderMatch(state);
  }

  renderLastAction(state.lastAction);
}

function renderMatch(s) {
  showMatchSlots();

  const teams = s.teams || {};
  const us = teams.us || {};
  const opp = teams.opp || {};

  setText('.score-home', String(us.score ?? 0));
  setText('.score-away', String(opp.score ?? 0));

  const usName = (us.name || 'Wir') + (us.serving ? ` ${SERVE_EMOJI}` : '');
  const oppName = (opp.name || 'Gegner') + (opp.serving ? ` ${SERVE_EMOJI}` : '');
  setText('.team-us-name', usName);
  setText('.team-opp-name', oppName);

  toggleClass('.serve-us', 'active', !!us.serving);
  toggleClass('.serve-opp', 'active', !!opp.serving);

  const setNumber = s.set?.number ?? 1;
  setText('#set-indicator', `Set ${setNumber}`);

  setText('#set-history', formatSetHistory(s.setScores || []));

  renderBadge(s.flags || {});
}

function toggleClass(sel, cls, on) {
  const el = document.querySelector(sel);
  if (el) el.classList.toggle(cls, on);
}

function renderTraining(s) {
  hideMatchSlots();

  const drill = s.drillLabel || TRAINING_LABEL;
  setText('#set-indicator', drill);
  setText('#set-history', '');
  setText('.team-us-name', '');
  setText('.team-opp-name', '');

  const counters = s.counters || {};
  const html = Object.entries(counters)
    .map(
      ([k, v]) =>
        `<span class="counter"><strong>${escapeHtml(humanize(k))}</strong> ${escapeHtml(
          String(v)
        )}</span>`
    )
    .join(' &nbsp; ');
  const countersEl = document.querySelector('#overlay-counters');
  if (countersEl) {
    countersEl.innerHTML = html;
    countersEl.style.display = 'block';
  }

  hideBadge();
}

function renderBadge(flags) {
  const badge = document.querySelector('#set-badge');
  if (!badge) return;

  const isMatchPoint = flags.matchPointUs || flags.matchPointOpp;
  const isSetPoint = flags.setPointUs || flags.setPointOpp;

  if (isMatchPoint) {
    badge.textContent = 'Matchball';
    badge.dataset.kind = 'match';
    badge.style.display = 'block';
    badge.style.background = 'var(--match-point)';
  } else if (isSetPoint) {
    badge.textContent = 'Setball';
    badge.dataset.kind = 'set';
    badge.style.display = 'block';
    badge.style.background = 'var(--set-point)';
  } else {
    hideBadge();
  }
}

function hideBadge() {
  const badge = document.querySelector('#set-badge');
  if (badge) {
    badge.style.display = 'none';
    badge.textContent = '';
  }
}

function renderLastAction(la) {
  const el = document.querySelector('#last-action');
  if (!el) return;

  if (!la) {
    el.classList.remove('visible');
    el.textContent = '';
    return;
  }

  const num = la.number != null ? `#${la.number}` : '';
  const player = la.player || '';
  const parts = [la.type, num, player ? `— ${player}` : ''].filter(Boolean);
  el.textContent = parts.join(' ').replace(/\s+/g, ' ').trim();
  el.classList.add('visible');

  if (lastActionTimer) clearTimeout(lastActionTimer);
  lastActionTimer = setTimeout(() => {
    el.classList.remove('visible');
  }, LAST_ACTION_FADE_MS);
}

function showMatchSlots() {
  const score = document.querySelector('#overlay-score');
  if (score) score.style.display = '';
  const counters = document.querySelector('#overlay-counters');
  if (counters) counters.style.display = 'none';
}

function hideMatchSlots() {
  const score = document.querySelector('#overlay-score');
  if (score) score.style.display = 'none';
}

function formatSetHistory(scores) {
  return scores
    .map((s) => {
      if (Array.isArray(s)) return `${s[0]}-${s[1]}`;
      return `${s.us}-${s.opp}`;
    })
    .join(' | ');
}

function setText(sel, text) {
  const el = document.querySelector(sel);
  if (el) el.textContent = text;
}

function humanize(k) {
  return k.charAt(0).toUpperCase() + k.slice(1);
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c]
  );
}

/**
 * Show stale indicator (yellow dot) when heartbeat is lost.
 */
export function markStale() {
  const el = document.querySelector('#stale-indicator');
  if (el) el.classList.add('visible');
}

export function clearStale() {
  const el = document.querySelector('#stale-indicator');
  if (el) el.classList.remove('visible');
}
