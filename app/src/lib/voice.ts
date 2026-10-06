/**
 * Turns what the speech recogniser heard into a kitchen command. Pure (no React, no native
 * modules): tested in test/voice.test.ts.
 *
 * Phrases it understands (the number is the big heading on the ticket, i.e. the pager number,
 * or the order number when the order has no pager):
 *   "complete pager 12"   "pager 12 complete"   "12 done"   "bump 12"   "finished order 41"
 *   "pager 12 ready"      "order 41 ready"
 */
import type { Ticket } from './kitchen';

export type VoiceAction = 'bump' | 'ready';

export type VoiceResult =
  | { kind: 'command'; action: VoiceAction; ticket: Ticket; label: string }
  | { kind: 'nomatch'; action: VoiceAction; label: string }
  | null;

const BUMP = new Set(['complete', 'completed', 'done', 'bump', 'bumped', 'finish', 'finished']);
const READY = new Set(['ready']);
const PAGER = new Set(['pager', 'pagers', 'page', 'pages']);
const ORDER = new Set(['order', 'orders', 'ticket', 'number']);

const ONES: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** Lower-case words and digit groups; "twenty-one" and "twenty one" both become 21. */
export function tokenize(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/#/g, ' number ')
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    if (w in TENS) {
      const next = raw[i + 1];
      if (next && next in ONES && ONES[next] >= 1 && ONES[next] <= 9) {
        out.push(String(TENS[w] + ONES[next]));
        i++;
      } else out.push(String(TENS[w]));
    } else if (w in ONES) out.push(String(ONES[w]));
    else out.push(w);
  }
  return out;
}

const isNum = (t: string | undefined): t is string => !!t && /^[0-9]+$/.test(t);

/** Finds the number the speaker meant and which kind of number they said ("pager", "order" or neither). */
function findTarget(tokens: string[]): { kind: 'pager' | 'order' | 'any'; value: string } | null {
  for (let i = 0; i < tokens.length - 1; i++) {
    if (PAGER.has(tokens[i]) && isNum(tokens[i + 1])) return { kind: 'pager', value: String(Number(tokens[i + 1])) };
    if (ORDER.has(tokens[i]) && isNum(tokens[i + 1])) return { kind: 'order', value: String(Number(tokens[i + 1])) };
  }
  const bare = tokens.find(isNum);
  return bare ? { kind: 'any', value: String(Number(bare)) } : null;
}

const samePager = (t: Ticket, v: string) => t.pager != null && /^[0-9]+$/.test(t.pager) && String(Number(t.pager)) === v;

/** `tickets` are the ones on screen. Returns null when the phrase isn't a command at all. */
export function parseVoiceCommand(transcript: string, tickets: Ticket[]): VoiceResult {
  const tokens = tokenize(transcript);
  const action: VoiceAction | null = tokens.some((t) => BUMP.has(t)) ? 'bump' : tokens.some((t) => READY.has(t)) ? 'ready' : null;
  if (!action) return null;
  const target = findTarget(tokens);
  if (!target) return null;

  const byPager = tickets.find((t) => samePager(t, target.value));
  const byOrder = tickets.find((t) => String(t.number) === target.value);
  // The heading shows the pager when there is one, so a bare number means the pager first.
  const ticket = target.kind === 'pager' ? byPager : target.kind === 'order' ? byOrder : byPager ?? byOrder;
  const label = target.kind === 'order' ? `order ${target.value}` : target.kind === 'pager' ? `pager ${target.value}` : target.value;
  return ticket ? { kind: 'command', action, ticket, label } : { kind: 'nomatch', action, label };
}
