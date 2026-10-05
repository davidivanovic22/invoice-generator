const parse = (hex: string): [number, number, number] => {
  let value = hex.replace('#', '').trim();
  if (value.length === 3) value = value.split('').map((char) => char + char).join('');
  const int = parseInt(value.slice(0, 6), 16);
  if (Number.isNaN(int)) return [79, 70, 229];
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
};

const toHex = (rgb: number[]) => `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;

/** Mixes a colour toward white; amount 0 = original, 1 = white. */
export const tint = (hex: string, amount: number) => toHex(parse(hex).map((channel) => channel + (255 - channel) * amount));

/** Mixes a colour toward black; amount 0 = original, 1 = black. */
export const shade = (hex: string, amount: number) => toHex(parse(hex).map((channel) => channel * (1 - amount)));

export const alpha = (hex: string, opacity: number) => {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const luminance = (hex: string) => {
  const [r, g, b] = parse(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** White or near-black, whichever reads better on the given background. */
export const readableOn = (hex: string) => (luminance(hex) > 0.45 ? '#0f172a' : '#ffffff');

/** Darkens light accents until they're legible as text on white. */
export const textSafe = (hex: string) => {
  let color = hex;
  for (let step = 0; step < 6 && luminance(color) > 0.3; step++) color = shade(color, 0.15);
  return color;
};
