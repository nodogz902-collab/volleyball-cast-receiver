import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { update, markStale, clearStale, resetOverlay } from '../overlay.js';

function setupDom() {
  document.body.className = 'theme-coach';
  document.body.innerHTML = `
    <div id="overlay">
      <div id="scorebar">
        <div id="set-indicator"></div>
        <div id="set-history"></div>
        <div class="scorebar-team scorebar-team-us">
          <span class="team-us-name"></span>
          <span class="serve-dot serve-us">🏐</span>
          <span class="score-home"></span>
        </div>
        <div class="scorebar-team scorebar-team-opp">
          <span class="team-opp-name"></span>
          <span class="serve-dot serve-opp">🏐</span>
          <span class="score-away"></span>
        </div>
      </div>
      <div id="overlay-counters"></div>
      <div id="overlay-bottom">
        <div id="last-action"></div>
        <div id="set-badge"></div>
      </div>
      <div id="stale-indicator"></div>
    </div>
  `;
}

function makeMatchState(overrides = {}) {
  return {
    type: 'state',
    v: 1,
    sport: 'coach',
    matchId: 'm1',
    format: 'bo3',
    isTraining: false,
    teams: {
      us: { name: 'Wir', players: [], score: 14, serving: false },
      opp: { name: 'Gegner', score: 11, serving: true },
    },
    set: { number: 2, limit: 25, isFinal: false },
    setsWon: { us: 1, opp: 0 },
    setsToWin: 2,
    setScores: [{ us: 25, opp: 18 }],
    flags: {
      setPointUs: false,
      setPointOpp: false,
      matchPointUs: false,
      matchPointOpp: false,
      matchDecided: false,
    },
    ...overrides,
  };
}

describe('overlay - match layout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupDom();
    resetOverlay();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders us + opp scores from canonical teams shape', () => {
    update(makeMatchState());
    expect(document.querySelector('.score-home').textContent).toBe('14');
    expect(document.querySelector('.score-away').textContent).toBe('11');
  });

  it('renders set indicator with set number', () => {
    update(makeMatchState());
    expect(document.querySelector('#set-indicator').textContent).toContain('Set 2');
  });

  it('renders set history with us-opp scores joined by |', () => {
    update(
      makeMatchState({
        set: { number: 3, limit: 15, isFinal: true },
        setScores: [
          { us: 25, opp: 18 },
          { us: 19, opp: 25 },
        ],
      })
    );
    const history = document.querySelector('#set-history').textContent;
    expect(history).toContain('25-18');
    expect(history).toContain('19-25');
    expect(history).toContain('|');
  });

  it('renders team names', () => {
    update(
      makeMatchState({
        teams: {
          us: { name: 'Lions', players: [], score: 5, serving: false },
          opp: { name: 'Tigers', score: 4, serving: false },
        },
      })
    );
    expect(document.querySelector('.team-us-name').textContent).toContain('Lions');
    expect(document.querySelector('.team-opp-name').textContent).toContain('Tigers');
  });

  it('shows serving indicator on serving team', () => {
    update(
      makeMatchState({
        teams: {
          us: { name: 'Wir', players: [], score: 5, serving: true },
          opp: { name: 'Gegner', score: 4, serving: false },
        },
      })
    );
    const usName = document.querySelector('.team-us-name').textContent;
    const oppName = document.querySelector('.team-opp-name').textContent;
    expect(usName).toContain('🏐');
    expect(oppName).not.toContain('🏐');
    expect(document.querySelector('.serve-us').classList.contains('active')).toBe(true);
    expect(document.querySelector('.serve-opp').classList.contains('active')).toBe(false);
  });

  it('toggles serve-dot when serving switches to opponent', () => {
    update(makeMatchState()); // opp serving from baseline
    expect(document.querySelector('.serve-us').classList.contains('active')).toBe(false);
    expect(document.querySelector('.serve-opp').classList.contains('active')).toBe(true);
  });

  it('hides set badge when no flags set', () => {
    update(makeMatchState());
    const badge = document.querySelector('#set-badge');
    expect(badge.style.display).toBe('none');
  });

  it('shows Setball badge when setPointUs is true', () => {
    update(
      makeMatchState({
        teams: {
          us: { name: 'Wir', players: [], score: 24, serving: false },
          opp: { name: 'Gegner', score: 22, serving: false },
        },
        flags: {
          setPointUs: true,
          setPointOpp: false,
          matchPointUs: false,
          matchPointOpp: false,
          matchDecided: false,
        },
      })
    );
    const badge = document.querySelector('#set-badge');
    expect(badge.style.display).not.toBe('none');
    expect(badge.textContent.toLowerCase()).toContain('setball');
  });

  it('shows Matchball badge when matchPoint flag is true (overrides setPoint)', () => {
    update(
      makeMatchState({
        flags: {
          setPointUs: true,
          setPointOpp: false,
          matchPointUs: true,
          matchPointOpp: false,
          matchDecided: false,
        },
      })
    );
    const badge = document.querySelector('#set-badge');
    expect(badge.style.display).not.toBe('none');
    expect(badge.textContent.toLowerCase()).toContain('matchball');
  });

  it('Matchball badge also shown when matchPointOpp is true', () => {
    update(
      makeMatchState({
        flags: {
          setPointUs: false,
          setPointOpp: false,
          matchPointUs: false,
          matchPointOpp: true,
          matchDecided: false,
        },
      })
    );
    expect(document.querySelector('#set-badge').textContent.toLowerCase()).toContain('matchball');
  });

  it('hides counters in match mode', () => {
    update(makeMatchState());
    const counters = document.querySelector('#overlay-counters');
    expect(counters.style.display).toBe('none');
  });

  it('shows score block in match mode', () => {
    update(makeMatchState());
    expect(document.querySelector('#scorebar')).toBeTruthy();
    expect(document.querySelector('.score-home').textContent).toBe('14');
  });
});

describe('overlay - last action', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupDom();
    resetOverlay();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders last action with type, player and number', () => {
    update(
      makeMatchState({
        lastAction: { type: 'Block', player: 'Mara', number: 4, ts: Date.now() },
      })
    );
    const la = document.querySelector('#last-action');
    expect(la.textContent).toContain('Block');
    expect(la.textContent).toContain('Mara');
    expect(la.textContent).toContain('#4');
    expect(la.classList.contains('visible')).toBe(true);
  });

  it('fades out last action after 3 seconds', () => {
    update(
      makeMatchState({
        lastAction: { type: 'Ace', player: 'Tom', number: 7, ts: Date.now() },
      })
    );
    const la = document.querySelector('#last-action');
    expect(la.classList.contains('visible')).toBe(true);
    vi.advanceTimersByTime(3001);
    expect(la.classList.contains('visible')).toBe(false);
  });

  it('does not show last action when undefined', () => {
    update(makeMatchState());
    const la = document.querySelector('#last-action');
    expect(la.classList.contains('visible')).toBe(false);
  });

  it('handles last action without player number', () => {
    update(
      makeMatchState({
        lastAction: { type: 'Error', player: 'Lisa', ts: Date.now() },
      })
    );
    const la = document.querySelector('#last-action');
    expect(la.textContent).toContain('Error');
    expect(la.textContent).toContain('Lisa');
    expect(la.textContent).not.toContain('#');
  });
});

describe('overlay - training layout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setupDom();
    resetOverlay();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps scorebar visible in training mode', () => {
    update({
      type: 'state',
      v: 1,
      sport: 'coach',
      format: 'training',
      isTraining: true,
      counters: { aces: 5, errors: 2, total: 12 },
      drillLabel: 'Aufschlag-Serie',
    });
    expect(document.querySelector('#scorebar')).toBeTruthy();
    expect(document.body.classList.contains('training')).toBe(true);
  });

  it('shows counters horizontally in training mode', () => {
    update({
      type: 'state',
      v: 1,
      sport: 'coach',
      format: 'training',
      isTraining: true,
      counters: { aces: 5, errors: 2, total: 12 },
      drillLabel: 'Aufschlag-Serie',
    });
    const counters = document.querySelector('#overlay-counters');
    expect(counters.style.display).not.toBe('none');
    expect(counters.textContent).toContain('5');
    expect(counters.textContent).toContain('Aces');
    expect(counters.textContent).toContain('Errors');
    expect(counters.textContent).toContain('Total');
    expect(counters.textContent).toContain('12');
  });

  it('shows drillLabel as set indicator in training mode', () => {
    update({
      type: 'state',
      v: 1,
      sport: 'coach',
      format: 'training',
      isTraining: true,
      counters: { aces: 5, errors: 2, total: 12 },
      drillLabel: 'Aufschlag-Serie',
    });
    expect(document.querySelector('#set-indicator').textContent).toContain('Aufschlag-Serie');
  });

  it('falls back to default training label when drillLabel missing', () => {
    update({
      type: 'state',
      v: 1,
      sport: 'coach',
      format: 'training',
      isTraining: true,
      counters: { aces: 0, errors: 0, total: 0 },
    });
    expect(document.querySelector('#set-indicator').textContent).toMatch(/Training/i);
  });

  it('hides badge in training mode even if flags accidentally set', () => {
    update({
      type: 'state',
      v: 1,
      sport: 'coach',
      format: 'training',
      isTraining: true,
      counters: { aces: 5, errors: 2, total: 12 },
      drillLabel: 'Drill',
    });
    expect(document.querySelector('#set-badge').style.display).toBe('none');
  });

  it('switches back from training to match layout', () => {
    update({
      type: 'state',
      v: 1,
      sport: 'coach',
      format: 'training',
      isTraining: true,
      counters: { aces: 1, errors: 0, total: 1 },
      drillLabel: 'Drill',
    });
    update(makeMatchState());
    expect(document.querySelector('#scorebar')).toBeTruthy();
    expect(document.querySelector('#overlay-counters').style.display).toBe('none');
  });
});

describe('overlay - stale indicator', () => {
  beforeEach(() => {
    setupDom();
    resetOverlay();
  });

  it('markStale adds visible class to indicator', () => {
    markStale();
    expect(document.querySelector('#stale-indicator').classList.contains('visible')).toBe(true);
  });

  it('clearStale removes visible class', () => {
    markStale();
    clearStale();
    expect(document.querySelector('#stale-indicator').classList.contains('visible')).toBe(false);
  });
});
