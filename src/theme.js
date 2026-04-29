/**
 * Apply a theme object (canonical schema) to the document.
 *
 * Sets CSS custom properties on :root from theme.colors and theme.fonts,
 * and toggles the `theme-{sport}` class on <body>. The receiver is fully
 * data-driven — no per-app CSS is hardcoded.
 *
 * @param {{
 *   id?: string,
 *   sport?: string,
 *   colors?: Record<string, string>,
 *   fonts?: { score?: string, label?: string },
 * } | null | undefined} theme
 */
export function applyTheme(theme) {
  if (!theme) return;

  const root = document.documentElement;
  const colors = theme.colors;

  if (colors) {
    setVar(root, '--bg-from', colors.bgFrom);
    setVar(root, '--bg-via', colors.bgVia);
    setVar(root, '--bg-to', colors.bgTo);
    setVar(root, '--accent', colors.accent);
    setVar(root, '--team-us', colors.teamUs);
    setVar(root, '--team-opp', colors.teamOpp);
    setVar(root, '--set-point', colors.setPoint);
    setVar(root, '--match-point', colors.matchPoint);
    setVar(root, '--text', colors.text);
    setVar(root, '--text-muted', colors.textMuted);
  }

  if (theme.fonts) {
    setVar(root, '--font-score', theme.fonts.score);
    setVar(root, '--font-label', theme.fonts.label);
  }

  if (theme.sport) {
    // Strip any prior theme-* classes so a switch fully replaces.
    const toRemove = [];
    document.body.classList.forEach((cls) => {
      if (cls.startsWith('theme-')) toRemove.push(cls);
    });
    toRemove.forEach((cls) => document.body.classList.remove(cls));
    document.body.classList.add(`theme-${theme.sport}`);
  }
}

function setVar(el, name, value) {
  if (value == null || value === '') return;
  el.style.setProperty(name, value);
}
