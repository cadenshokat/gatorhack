// Owner: Alfred (round 7). Stubs keep the build green until the real components land.
// Each component renders inside Calm view's shadow root and styles itself only with Calm's --wa-* tokens
// (see ../../tokens.ts: --wa-f, --wa-f-big, --wa-f-section, --wa-ink, --wa-ink-2, --wa-line, --wa-canvas, --wa-raised,
// --wa-r-media, --wa-gap, --wa-gap-s, --wa-row-pad, --wa-measure, --wa-wide-col, --wa-t, --wa-ctl ...).
import type {
  DataTableProps, LogoMarkProps, RecipeProps, ScheduleListProps, ScoreboardProps, StatGridProps,
} from './types';

export function StatGrid(_props: StatGridProps) {
  return null;
}
export function Scoreboard(_props: ScoreboardProps) {
  return null;
}
export function DataTable(_props: DataTableProps) {
  return null;
}
export function ScheduleList(_props: ScheduleListProps) {
  return null;
}
export function Recipe(_props: RecipeProps) {
  return null;
}
export function LogoMark(_props: LogoMarkProps) {
  return null;
}
/** CSS for all components, added to Calm view's constructed stylesheets. Never use url(). */
export const componentsCss = '';
