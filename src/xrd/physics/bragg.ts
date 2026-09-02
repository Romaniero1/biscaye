const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function dToTwoTheta(dAngstrom: number, wavelength = 1.5406): number {
  if (!(dAngstrom > 0) || !(wavelength > 0)) return Number.NaN;
  const ratio = wavelength / (2 * dAngstrom);
  if (ratio <= 0 || ratio > 1) return Number.NaN;
  return 2 * Math.asin(ratio) * RAD_TO_DEG;
}

export function twoThetaToD(twoTheta: number, wavelength = 1.5406): number {
  if (!(twoTheta > 0) || !(wavelength > 0)) return Number.NaN;
  const sine = Math.sin((twoTheta / 2) * DEG_TO_RAD);
  return sine > 0 ? wavelength / (2 * sine) : Number.NaN;
}
