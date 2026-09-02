export function gaussianValue(x: number, height: number, center: number, fwhm: number): number {
  if (!(height >= 0) || !(fwhm > 0)) return Number.NaN;
  return height * Math.exp(-4 * Math.LN2 * ((x - center) / fwhm) ** 2);
}

export function gaussianArea(height: number, fwhm: number): number {
  return height * fwhm * Math.sqrt(Math.PI) / (2 * Math.sqrt(Math.LN2));
}
