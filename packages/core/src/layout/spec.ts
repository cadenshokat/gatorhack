// Owner: A2.
import { z } from 'zod';
import type { FitSpec, PageOutline } from '../types';

export const FitSpecSchema: z.ZodType<FitSpec> = z.any() as unknown as z.ZodType<FitSpec>;
export const fitSpecJsonSchema: Record<string, unknown> = {};
export function repairSpec(_spec: FitSpec, _outline: PageOutline): { spec: FitSpec; repairs: string[] } { throw new Error('not implemented'); }
