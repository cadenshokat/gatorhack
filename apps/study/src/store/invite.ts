// Invitation links: https://<study host>/#i=<code>.<sequence>.<cohort> where code is 8 characters from a 31-letter
// alphabet (no 0/O/1/I/L), sequence 0–3, cohort p (pilot) or m (main). scripts/invites.mjs makes them in shuffled
// blocks of four so every sequence is used equally. The fragment never reaches a server, and it is removed from the
// address bar as soon as it is read.

export interface Invite {
  code: string;
  sequence: 0 | 1 | 2 | 3;
  cohort: 'pilot' | 'main' | 'preview';
}

export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function parseInvite(hash: string): Invite | null {
  const m = /(?:^#|&)i=([2-9A-HJKMNP-Z]{8})\.([0-3])\.([pm])(?:&|$)/.exec(hash);
  if (!m) return null;
  return { code: m[1]!, sequence: Number(m[2]) as Invite['sequence'], cohort: m[3] === 'p' ? 'pilot' : 'main' };
}

/** A preview: no link, answers stay on this phone. `?seq=0..3` picks the order for checking. */
export function previewInvite(search: string, rand: () => number): Invite {
  const q = /[?&]seq=([0-3])/.exec(search);
  let code = '';
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return { code: `PV${code.slice(2)}`, sequence: (q ? Number(q[1]) : Math.floor(rand() * 4)) as Invite['sequence'], cohort: 'preview' };
}

/** A 32-bit seed from the code, so a participant's family order is the same if they reload. */
export function seedFromCode(code: string): number {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
