// Owner: A2.
export interface Rgba { r: number; g: number; b: number; a: number }
export function parseColor(_css: string): Rgba | null { throw new Error('not implemented'); }
export function relativeLuminance(_c: Rgba): number { throw new Error('not implemented'); }
export function contrastRatio(_fg: Rgba, _bg: Rgba): number { throw new Error('not implemented'); }
export function liftToRatio(_fg: Rgba, _bg: Rgba, _ratio: number): string { throw new Error('not implemented'); }
