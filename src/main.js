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
import { update as updateOverlay, markStale, clearStale } from './overlay.js';
import { applyTheme } from './theme.js';

const CHANNEL_NS = 'urn:x-cast:com.alexhiller.cast.tracker';

// 2 missed heartbeats @ 5s = 10s threshold; per spec we then mark stale.
const STALE_THRESHOLD_MS = 10_000;
const STALE_CHECK_INTERVAL_MS = 1_000;

let lastHeartbeat = Date.now();
let isStale = false;

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
    default:
      // Unknown types are ignored deliberately for forward-compat.
      break;
  }
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
