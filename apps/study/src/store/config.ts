// Study settings from the build environment (apps/study/.env.local or Vercel). Collection is off until every agreement
// detail is set to its real, approved value: without them the study runs as a preview that keeps answers on the phone.

export interface StudyConfig {
  supabaseUrl: string | null;
  supabaseKey: string | null;
  contactEmail: string | null;
  /** Who runs the study, as shown in the agreement ("Caden Shokat and Sid Pandey, University of Florida"). */
  team: string | null;
  /** The ethics reference that applies (IRB or exempt determination), shown in the agreement. */
  approval: string | null;
  /** Access, retention and deletion, in one or two plain sentences. */
  retention: string | null;
  /** Last day a participant can ask for deletion by code, or "any time" for no last day. */
  withdrawBy: string | null;
  engineCommit: string;
}

const env = import.meta.env as Record<string, string | undefined>;
const val = (k: string): string | null => {
  const v = env[k]?.trim();
  return v ? v : null;
};

export const CONFIG: StudyConfig = {
  supabaseUrl: val('VITE_STUDY_SUPABASE_URL'),
  supabaseKey: val('VITE_STUDY_SUPABASE_KEY'),
  contactEmail: val('VITE_STUDY_CONTACT'),
  team: val('VITE_STUDY_TEAM'),
  approval: val('VITE_STUDY_APPROVAL'),
  retention: val('VITE_STUDY_RETENTION'),
  withdrawBy: val('VITE_STUDY_WITHDRAW_BY'),
  engineCommit: val('VITE_ENGINE_COMMIT') ?? 'dev',
};

/** Real collection needs storage and every agreement detail. */
export function collectionReady(c: StudyConfig = CONFIG): boolean {
  return !!(c.supabaseUrl && c.supabaseKey && c.contactEmail && c.team && c.approval && c.retention && c.withdrawBy);
}

/** No last day for deletion requests: withdrawBy is "any time". */
export function withdrawAnyTime(c: StudyConfig = CONFIG): boolean {
  return !!c.withdrawBy && /^any\s*time$/i.test(c.withdrawBy);
}
