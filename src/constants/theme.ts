import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#11131A',
    textSecondary: '#60646C',
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    canvas: '#F6F5F1',
    canvasDot: '#D5D3CB',
    border: '#E2E2E6',
    accent: '#6C5CE7',
    onAccent: '#FFFFFF',
    danger: '#D63031',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#B0B4BA',
    background: '#0B0B0F',
    backgroundElement: '#1C1D22',
    backgroundSelected: '#2E3135',
    canvas: '#121318',
    canvasDot: '#2A2C35',
    border: '#2A2C33',
    accent: '#8B7CF6',
    onAccent: '#FFFFFF',
    danger: '#FF7675',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Ink used on pastel note and to-do cards, which stay light in dark mode. */
export const CardInk = { text: '#1B1B1F', secondary: '#55565E' } as const;

export const NoteColors = ['#FFF3B0', '#FFD6E0', '#D7F9E9', '#DCEBFF', '#EADCFF'] as const;
export const SpaceColors = ['#6C5CE7', '#00B894', '#E17055', '#0984E3', '#E84393', '#FDCB6E'] as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const Radius = { small: 8, medium: 14, large: 22 } as const;

/** Window width at which we show two panes (unfolded foldables, tablets). */
export const WideBreakpoint = 700;
export const MaxContentWidth = 800;
