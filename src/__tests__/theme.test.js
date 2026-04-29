import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme } from '../theme.js';

const COACH_THEME = {
  id: 'coach',
  name: 'Coach',
  sport: 'coach',
  colors: {
    bgFrom: '#7c3aed',
    bgVia: '#6d28d9',
    bgTo: '#4c1d95',
    accent: '#f97316',
    teamUs: '#7c3aed',
    teamOpp: '#ea580c',
    setPoint: '#f59e0b',
    matchPoint: '#dc2626',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.75)',
  },
  fonts: {
    score: '"Inter", system-ui, sans-serif',
    label: '"Inter", system-ui, sans-serif',
  },
  emoji: { sport: '🏐', setPoint: '⚡', matchPoint: '🏆', serving: '🏐' },
};

const BEACH_THEME = {
  id: 'beach',
  name: 'Beach',
  sport: 'beach',
  colors: {
    bgFrom: '#06b6d4',
    bgVia: '#0ea5e9',
    bgTo: '#fbbf24',
    accent: '#0e7490',
    teamUs: '#0e7490',
    teamOpp: '#ea580c',
    setPoint: '#f97316',
    matchPoint: '#dc2626',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.75)',
  },
  fonts: {
    score: '"Inter", system-ui, sans-serif',
    label: '"Inter", system-ui, sans-serif',
  },
  emoji: { sport: '🏖️', setPoint: '⚡', matchPoint: '🏆', serving: '🏐' },
};

describe('applyTheme', () => {
  beforeEach(() => {
    document.body.className = '';
    document.documentElement.style.cssText = '';
  });

  it('sets all CSS color variables on :root from theme.colors', () => {
    applyTheme(COACH_THEME);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--bg-from')).toBe('#7c3aed');
    expect(root.style.getPropertyValue('--bg-via')).toBe('#6d28d9');
    expect(root.style.getPropertyValue('--bg-to')).toBe('#4c1d95');
    expect(root.style.getPropertyValue('--accent')).toBe('#f97316');
    expect(root.style.getPropertyValue('--team-us')).toBe('#7c3aed');
    expect(root.style.getPropertyValue('--team-opp')).toBe('#ea580c');
    expect(root.style.getPropertyValue('--set-point')).toBe('#f59e0b');
    expect(root.style.getPropertyValue('--match-point')).toBe('#dc2626');
    expect(root.style.getPropertyValue('--text')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--text-muted')).toBe('rgba(255,255,255,0.75)');
  });

  it('sets font CSS variables from theme.fonts', () => {
    applyTheme(COACH_THEME);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--font-score')).toContain('Inter');
    expect(root.style.getPropertyValue('--font-label')).toContain('Inter');
  });

  it('adds theme-{sport} body class', () => {
    applyTheme(COACH_THEME);
    expect(document.body.classList.contains('theme-coach')).toBe(true);
  });

  it('removes previous theme-* classes when switching', () => {
    applyTheme(COACH_THEME);
    applyTheme(BEACH_THEME);
    expect(document.body.classList.contains('theme-coach')).toBe(false);
    expect(document.body.classList.contains('theme-beach')).toBe(true);
  });

  it('overwrites old CSS variables on switch', () => {
    applyTheme(COACH_THEME);
    applyTheme(BEACH_THEME);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--bg-from')).toBe('#06b6d4');
    expect(root.style.getPropertyValue('--team-us')).toBe('#0e7490');
  });

  it('is a no-op when given falsy input', () => {
    applyTheme(null);
    applyTheme(undefined);
    expect(document.documentElement.style.getPropertyValue('--bg-from')).toBe('');
  });

  it('is a no-op when theme.colors is missing', () => {
    applyTheme({ sport: 'coach' });
    expect(document.documentElement.style.getPropertyValue('--bg-from')).toBe('');
  });

  it('skips font vars when theme.fonts missing', () => {
    applyTheme({ sport: 'coach', colors: COACH_THEME.colors });
    expect(document.documentElement.style.getPropertyValue('--font-score')).toBe('');
    expect(document.body.classList.contains('theme-coach')).toBe(true);
  });
});
