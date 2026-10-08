export function cycledIndex(index: number, step: number, length: number): number {
  return (index + step + length) % length;
}
