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
  const counters = document.querySelector('#overlay-counters');
  if (counters) counters.style.display = 'none';
}

function hideMatchSlots() {
  // Score stays visible in training too — volleyball is always
  // point-driven. Counters appear via the body.training rule.
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

// Event-type → display config for video-synced pop-ups. Kept on the receiver
// so we don't have to ship per-event labels in every events message.
const EVENT_DISPLAY = {
  kill:           { emoji: '💥', label: 'Kill' },
  ace:            { emoji: '🎯', label: 'Ace' },
  block:          { emoji: '🧱', label: 'Block' },
  opp_error:      { emoji: '💢', label: 'Gegner-Fehler' },
  error:          { emoji: '❌', label: 'Eigenfehler' },
  service_error:  { emoji: '🚫', label: 'Aufschlag-Fehler' },
  block_error:    { emoji: '⛔', label: 'Block-Fehler' },
  opp_point:      { emoji: '⬇️', label: 'Punkt Gegner' },
  reception_good: { emoji: '🛡️', label: 'Reception +' },
  reception_bad:  { emoji: '⚠️', label: 'Reception −' },
  attack_attempt: { emoji: '🏹', label: 'Angriff' },
  assist:         { emoji: '🎁', label: 'Assist' },
};

/**
 * Update the score directly from a single enriched cast event. Used during
 * video-synced replay to bypass the regular state push.
 */
export function applyVideoSyncedScore(evt) {
  if (!evt) return;
  setText('.score-home', String(evt.scoreUs ?? 0));
  setText('.score-away', String(evt.scoreOpp ?? 0));
  setText('#set-indicator', `Set ${evt.set ?? 1}`);
}

/**
 * Reset score display to 0:0 (used when seeking back to before any event).
 */
export function resetScoreDisplay() {
  setText('.score-home', '0');
  setText('.score-away', '0');
  setText('#set-indicator', 'Set 1');
}

/**
 * Push a transient event card onto the popup stack.
 */
export function showEventPopup(evt) {
  const container = document.querySelector('#event-popup-container');
  if (!container || !evt) return;

  const cfg = EVENT_DISPLAY[evt.type] || { emoji: '⚪', label: evt.type || 'Event' };
  const popup = document.createElement('div');
  popup.className = 'event-popup' + (evt.team === 'us' ? ' popup-us' : evt.team === 'opp' ? ' popup-opp' : '');

  const playerLine = evt.player
    ? `<div class="popup-player">${escapeHtml(evt.player)}${evt.number != null ? ' #' + escapeHtml(String(evt.number)) : ''}</div>`
    : '';

  const showScore = evt.team === 'us' || evt.team === 'opp';
  const scoreLine = showScore
    ? `<div class="popup-score">${evt.scoreUs ?? 0} : ${evt.scoreOpp ?? 0}</div>`
    : '';

  popup.innerHTML = `
    <div class="popup-emoji">${cfg.emoji}</div>
    <div class="popup-text">
      <div class="popup-label">${escapeHtml(cfg.label)}</div>
      ${playerLine}
    </div>
    ${scoreLine}
  `;

  container.appendChild(popup);
  // Two-frame delay so the initial transform takes effect before transition.
  requestAnimationFrame(() => requestAnimationFrame(() => popup.classList.add('visible')));

  setTimeout(() => {
    popup.classList.remove('visible');
    setTimeout(() => popup.remove(), 400);
  }, 1500);
}

/**
 * Clear all currently-rendered event popups. Used when seeking backwards
 * or when a new events feed arrives.
 */
export function clearEventPopups() {
  const container = document.querySelector('#event-popup-container');
  if (container) container.innerHTML = '';
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
