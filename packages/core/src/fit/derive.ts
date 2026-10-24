// Owner: A2.
import type { FitProfile, FitSummaryForModel, FittingRaw } from '../types';

export function deriveFit(_raw: FittingRaw): FitProfile { throw new Error('not implemented'); }
export function defaultFit(): FitProfile { throw new Error('not implemented'); }
export function summarizeFitForModel(_fit: FitProfile): FitSummaryForModel { throw new Error('not implemented'); }
export function describeFit(_fit: FitProfile): Array<{ label: string; from: string; to: string }> { throw new Error('not implemented'); }
export declare const DEMO_FITS: { rosa: FitProfile; typical: FitProfile; reader: FitProfile };
