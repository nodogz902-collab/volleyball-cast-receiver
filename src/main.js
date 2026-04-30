/**
 * Cast Application Framework (CAF) Receiver SDK v3 entry point.
 *
 * Responsibilities:
 *  - Init CastReceiverContext + register custom-channel listener.
 *  - Route incoming JSON messages to overlay/theme.
 *  - Track heartbeat and surface a stale indicator when broken.
 *  - Standard CAF media playback (LOAD/seek/volume) is handled by the SDK.
 */

import './styles.css';
import {
  update as updateOverlay,
  markStale,
  clearStale,
  applyVideoSyncedScore,
  resetScoreDisplay,
  showEventPopup,
  clearEventPopups,
} from './overlay.js';
import { applyTheme } from './theme.js';

const CHANNEL_NS = 'urn:x-cast:com.alexhiller.cast.tracker';

// 2 missed heartbeats @ 5s = 10s threshold; per spec we then mark stale.
const STALE_THRESHOLD_MS = 10_000;
const STALE_CHECK_INTERVAL_MS = 1_000;

let lastHeartbeat = Date.now();
let isStale = false;

// Video-synced events feed (set by 'events' messages). When non-empty,
// timeupdate ticks drive the score and popups instead of relying on
// per-frame state pushes.
let castEvents = [];
let lastSyncedTime = -1;
let videoListenerWired = false;

/**
 * Parse and route a single inbound custom-channel message.
 * Exported for unit-testing without the Cast SDK.
 */
export function handleMessage(msg) {
  if (!msg || typeof msg !== 'object' || !msg.type) return;

  switch (msg.type) {
    case 'theme':
      if (msg.theme) applyTheme(msg.theme);
      break;
    case 'state':
      lastHeartbeat = Date.now();
      if (isStale) {
        isStale = false;
        clearStale();
      }
      updateOverlay(msg);
      break;
    case 'heartbeat':
      lastHeartbeat = Date.now();
      if (isStale) {
        isStale = false;
        clearStale();
      }
      break;
    case 'events':
      castEvents = Array.isArray(msg.events) ? msg.events : [];
      lastSyncedTime = -1;
      clearEventPopups();
      ensureVideoSyncListener();
      // Snap to current time immediately so reconnects don't show 0:0.
      applyVideoSyncForCurrentTime({ silent: true });
      break;
    default:
      // Unknown types are ignored deliberately for forward-compat.
      break;
  }
}

function ensureVideoSyncListener() {
  if (videoListenerWired) return;
  const v = typeof document !== 'undefined' ? document.querySelector('#video') : null;
  if (!v) return;
  v.addEventListener('timeupdate', onVideoTimeUpdate);
  v.addEventListener('seeking', onVideoSeek);
  videoListenerWired = true;
}

function onVideoTimeUpdate() {
  applyVideoSyncForCurrentTime({ silent: false });
}

function onVideoSeek() {
  // Backward jumps reset the popup state so we don't replay everything in
  // a burst when the user seeks forward again.
  const v = document.querySelector('#video');
  if (!v) return;
  if (v.currentTime < lastSyncedTime) {
    lastSyncedTime = v.currentTime;
    clearEventPopups();
    applyVideoSyncForCurrentTime({ silent: true });
  }
}

function applyVideoSyncForCurrentTime({ silent }) {
  if (!castEvents.length) return;
  const v = typeof document !== 'undefined' ? document.querySelector('#video') : null;
  const t = v ? v.currentTime : 0;

  // Fire popups for events that fall in (lastSyncedTime, t]. Skip when
  // silent (initial snap or seek) to avoid replay bursts.
  if (!silent) {
    for (const e of castEvents) {
      if (e.videoTime > lastSyncedTime && e.videoTime <= t) {
        showEventPopup(e);
      }
    }
  }

  // Latest event ≤ t drives the displayed score.
  let latest = null;
  for (const e of castEvents) {
    if (e.videoTime <= t) latest = e;
    else break;
  }
  if (latest) applyVideoSyncedScore(latest);
  else resetScoreDisplay();

  lastSyncedTime = t;
}

function checkStale() {
  if (Date.now() - lastHeartbeat > STALE_THRESHOLD_MS) {
    if (!isStale) {
      isStale = true;
      markStale();
    }
  }
}

// In a unit-test environment (happy-dom) the cast global is absent.
// We only wire up the SDK when it's actually present (i.e. on a real device).
const castGlobal =
  typeof globalThis !== 'undefined' && typeof globalThis.cast !== 'undefined'
    ? globalThis.cast
    : null;

if (castGlobal && castGlobal.framework) {
  const context = castGlobal.framework.CastReceiverContext.getInstance();

  context.addCustomMessageListener(CHANNEL_NS, (event) => {
    let payload;
    try {
      payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch {
      return;
    }
    handleMessage(payload);
  });

  setInterval(checkStale, STALE_CHECK_INTERVAL_MS);

  context.start({
    customNamespaces: {
      [CHANNEL_NS]: castGlobal.framework.system.MessageType.JSON,
    },
  });
} else if (typeof window !== 'undefined') {
  // Local dev (no Cast SDK): expose helpers on window so dev-harness.html
  // and DevTools can drive the overlay manually.
  setInterval(checkStale, STALE_CHECK_INTERVAL_MS);
  window.__castReceiver = { handleMessage, applyTheme, updateOverlay };
}
