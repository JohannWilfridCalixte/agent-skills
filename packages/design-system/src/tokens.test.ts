import { describe, expect, it } from 'vitest';

import styles from './styles.css?raw';

const AA_TEXT = 4.5;

/** Text token on background token: every pair the components render text with. */
const TEXT_PAIRS = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['muted-foreground', 'card'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['primary', 'background'],
  ['danger', 'background'],
  ['success', 'background'],
  ['warning', 'background'],
] as const;

function contrast(first: string, second: string) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((channel) => (channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function tokenBlock(selector: string) {
  const start = styles.indexOf(`${selector} {`);
  const end = styles.indexOf('}', start);
  if (start === -1) throw new Error(`No ${selector} block in styles.css`);
  return Object.fromEntries([...styles.slice(start, end).matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/g)].map((match) => [match[1], match[2]]));
}

const THEMES = {
  'dark': tokenBlock('.dark'),
  'dark (system)': tokenBlock(':root:not(.light)'),
  'light': tokenBlock(':root'),
};

describe('theme tokens', () => {
  it.each(Object.entries(THEMES).flatMap(([theme, tokens]) => TEXT_PAIRS.map(([text, background]) => ({ background, text, theme, tokens }))))(
    '$theme: $text on $background meets WCAG AA',
    ({ background, text, tokens }) => {
      const ratio = contrast(tokens[text] ?? '', tokens[background] ?? '');

      expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it('keeps the system dark block identical to the .dark class block', () => {
    expect(THEMES['dark (system)']).toEqual(THEMES.dark);
  });
});
