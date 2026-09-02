function logGamma(value: number): number {
  const coefficients = [
    0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.5073432786869, -0.13857109526572, 9.98436957801957e-6,
    1.50563273514931e-7,
  ];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const z = value - 1;
  let sum = coefficients[0];
  for (let index = 1; index < coefficients.length; index += 1) sum += coefficients[index] / (z + index);
  const t = z + coefficients.length - 1.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

export function pearsonVIIValue(x: number, height: number, center: number, fwhm: number, shapeM: number): number {
  if (!(height >= 0) || !(fwhm > 0) || !(shapeM > 0.5)) return Number.NaN;
  const factor = 4 * (2 ** (1 / shapeM) - 1);
  return height * (1 + factor * ((x - center) / fwhm) ** 2) ** (-shapeM);
}

export function pearsonVIIArea(height: number, fwhm: number, shapeM: number): number {
  if (!(shapeM > 0.5)) return Number.NaN;
  const denominator = 2 * Math.sqrt(2 ** (1 / shapeM) - 1);
  return height * fwhm * Math.sqrt(Math.PI) * Math.exp(logGamma(shapeM - 0.5) - logGamma(shapeM)) / denominator;
}
