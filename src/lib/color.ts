/** Average of hex colours, used to show a tier's blended liquid as one colour. */
export function mixColors(hexes: string[]): string | null {
  if (hexes.length === 0) return null;
  const channels = [0, 0, 0];
  for (const hex of hexes) {
    const value = parseInt(hex.replace("#", ""), 16);
    channels[0] += (value >> 16) & 255;
    channels[1] += (value >> 8) & 255;
    channels[2] += value & 255;
  }
  return `#${channels
    .map((c) => Math.round(c / hexes.length).toString(16).padStart(2, "0"))
    .join("")}`;
}
