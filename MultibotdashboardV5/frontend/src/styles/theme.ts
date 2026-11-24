/**
 * Theme configuration for dark/light modes.
 */

export type Theme = 'light' | 'dark' | 'system';

const THEME_KEY = 'freqtrade-dashboard-theme';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';

  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

export function setStoredTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
}

export function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemPreference();
  }
  return theme;
}

export function applyTheme(theme: Theme): void {
  const effectiveTheme = getEffectiveTheme(theme);

  if (effectiveTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  setStoredTheme(theme);
}

export function toggleTheme(): void {
  const current = getStoredTheme();
  const effective = getEffectiveTheme(current);
  // Toggle between light and dark
  const newTheme = effective === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
}

export function initTheme(): void {
  const storedTheme = getStoredTheme();
  applyTheme(storedTheme);

  // Listen for system preference changes
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      const currentTheme = getStoredTheme();
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    });
  }
}

// Color palette for consistent styling
export const colors = {
  // Health state colors
  healthy: {
    bg: 'bg-green-100 dark:bg-green-900',
    text: 'text-green-600 dark:text-green-400',
    dot: 'bg-green-500',
    border: 'border-green-500',
  },
  degraded: {
    bg: 'bg-yellow-100 dark:bg-yellow-900',
    text: 'text-yellow-600 dark:text-yellow-400',
    dot: 'bg-yellow-500',
    border: 'border-yellow-500',
  },
  unreachable: {
    bg: 'bg-red-100 dark:bg-red-900',
    text: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
    border: 'border-red-500',
  },
  unknown: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
    dot: 'bg-gray-500',
    border: 'border-gray-500',
  },

  // Profit colors
  profit: {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-gray-400',
  },

  // Environment colors
  docker: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  baremetal: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  k8s: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  manual: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
} as const;

export function getHealthColor(state: string) {
  switch (state) {
    case 'healthy':
      return colors.healthy;
    case 'degraded':
      return colors.degraded;
    case 'unreachable':
      return colors.unreachable;
    default:
      return colors.unknown;
  }
}

export function getProfitColor(profit: number): string {
  if (profit > 0) return colors.profit.positive;
  if (profit < 0) return colors.profit.negative;
  return colors.profit.neutral;
}

export function getEnvironmentColor(env: string): string {
  switch (env) {
    case 'docker':
      return colors.docker;
    case 'baremetal':
      return colors.baremetal;
    case 'k8s':
      return colors.k8s;
    case 'manual':
      return colors.manual;
    default:
      return colors.manual;
  }
}
