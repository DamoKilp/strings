export function calculateLuminance(r: number, g: number, b: number): number {
  const [R, G, B] = [r, g, b].map(v => {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function extractDominantColor(gradient: string): { r: number; g: number; b: number } {
  const match = gradient.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (match) {
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
  }
  return { r: 120, g: 100, b: 240 };
}

export function getAdaptiveTextColors(luminance: number, isDarkTheme: boolean) {
  const highContrast = luminance > 0.6 ? '#0A0A0A' : '#F9FAFB';
  const primary = highContrast;
  const secondary = luminance > 0.6 ? 'rgba(10,10,10,0.7)' : 'rgba(249,250,251,0.75)';
  const tertiary = luminance > 0.6 ? 'rgba(10,10,10,0.6)' : 'rgba(249,250,251,0.6)';
  const interactive = isDarkTheme ? '#93C5FD' : '#2563EB';
  return { primary, secondary, tertiary, interactive, highContrast };
}

export function getSafeBackgroundRGB(luminance: number, isDarkTheme: boolean): string {
  if (luminance > 0.6) return '255,255,255';
  if (luminance < 0.3) return '0,0,0';
  return isDarkTheme ? '12,18,32' : '241,245,249';
}




