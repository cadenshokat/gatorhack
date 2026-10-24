// zod schemas for every request body. Unknown keys are stripped, so only known fields can reach a model.
// Object key order follows the contract (Jev reads evidence in the order it is serialised).
import { z } from 'zod';
import type {
  ElementEvidence, ExplainRequest, FitSummaryForModel, OutlineNode, OverlayButtonEvidence, OverlayEvidence, OverlayKind,
  PageDigest, PageOutline, Role, StruggleSignals, VisualVerifyRequest,
} from '@webable/core';

const ID = /^n\d{1,6}$/;
const id = z.string().regex(ID, 'ids look like n12');
const text = (max: number) => z.string().max(max);

export const ZONES = [
  'header_band', 'left_rail', 'center_column', 'right_rail', 'full_width_mid',
  'footer_band', 'overlay_top', 'overlay_bottom', 'overlay_center', 'overlay_corner',
] as const;

export const ROLES = [
  'main_content', 'form_field', 'action_button', 'navigation', 'search', 'advertising',
  'recommendations', 'popup_overlay', 'consent_notice', 'help_contact', 'account_utility',
  'legal_footer', 'other',
] as const;

export const OUTLINE_KINDS = [
  'heading', 'text', 'button', 'link', 'field', 'select', 'checkbox', 'radio',
  'image', 'list', 'table', 'region', 'media', 'notice',
] as const;

const Zone = z.enum(ZONES);
export const RoleSchema: z.ZodType<Role> = z.enum(ROLES);

export const ElementEvidenceSchema: z.ZodType<ElementEvidence> = z.object({
  id,
  tag: text(32),
  role_hint: text(64),
  label: text(400),
  zone: Zone,
  landmark: text(64),
  size: text(40),
  position: text(120),
  fixed: z.boolean(),
  class_words: z.array(text(40)).max(12),
  visual_weight: z.enum(['low', 'medium', 'high']),
  iframe_kind: text(40).optional(),
  link_target: z.enum(['same page', 'this website', 'another website']).optional(),
  text_chars: z.number().int().min(0).max(10_000_000).optional(),
  cards: z.number().int().min(0).max(10_000).optional(),
});

export const PageDigestSchema: z.ZodType<PageDigest> = z.object({
  v: z.literal('digest.1'),
  page: z.object({
    title: text(400),
    url_path: text(600),
    headings: z.array(text(300)).max(80),
    landmarks: z.array(text(64)).max(60),
    viewport: text(80),
    element_count: z.number().int().min(0).max(1_000_000),
  }),
  elements: z.array(ElementEvidenceSchema).min(1, 'the digest has no elements').max(400),
  mainCandidates: z.array(id).max(80),
  hasSensitiveFields: z.boolean(),
  lang: text(24),
});

/** `noCache: true` asks Jev live (the first read of a page in a session); the answer still refreshes the cache. */
export const UnderstandBody = z.object({ digest: PageDigestSchema, noCache: z.boolean().optional() });

export const StruggleSignalsSchema: z.ZodType<StruggleSignals> = z
  .object({ page_kind: text(80), time_on_page: text(80), task_progress: text(120) })
  .catchall(text(400))
  .refine((s) => Object.keys(s).length <= 40, 'at most 40 signals');

export const StruggleBody = z.object({ signals: StruggleSignalsSchema });

export const OutlineNodeSchema: z.ZodType<OutlineNode> = z.object({
  id,
  kind: z.enum(OUTLINE_KINDS),
  level: z.number().int().min(1).max(6).optional(),
  label: text(400),
  shape: text(80).optional(),
  parent: id.optional(),
  landmark: text(64).optional(),
  zone: Zone.optional(),
  jevRole: RoleSchema.optional(),
  protected: z.boolean().optional(),
});

export const PageOutlineSchema: z.ZodType<PageOutline> = z.object({
  v: z.literal('outline.1'),
  nodes: z.array(OutlineNodeSchema).max(3_000),
  pageTypeHint: text(60).optional(),
});

export const FitSummarySchema: z.ZodType<FitSummaryForModel> = z.object({
  text_need: z.enum(['none', 'some', 'large']),
  target_need: z.enum(['none', 'some', 'large']),
  clutter_tolerance: z.enum(['high', 'medium', 'low']),
  structure_level: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  motion: z.enum(['fine', 'reduce']),
  polarity: z.enum(['light', 'dark', 'none']),
});

export const RedesignBody = z.object({
  outline: PageOutlineSchema,
  fit: FitSummarySchema,
  roles: z.record(id, RoleSchema).default({}),
});

export const ExplainRequestSchema: z.ZodType<ExplainRequest> = z.object({
  passage: z.string().min(1, 'nothing to explain').max(8_000),
  pageKind: text(80),
});

export const ExplainBody = z.object({ req: ExplainRequestSchema });

/** Base64 image, with or without a data: URL prefix (captureVisibleTab returns a data URL). */
const Base64Image = z
  .string()
  .max(7_500_000)
  .transform((s) => s.replace(/^data:image\/[a-z+]+;base64,/i, '').replace(/\s+/g, ''))
  .refine((s) => s.length >= 64 && /^[A-Za-z0-9+/]+={0,2}$/.test(s), 'expected a base64 PNG');

export const VisualVerifySchema: z.ZodType<VisualVerifyRequest, unknown> = z.object({
  before: Base64Image,
  after: Base64Image,
  controls: z.array(text(200)).max(80),
  help: z.array(text(200)).max(30),
  mainLabel: text(200).nullable(),
});

export const OVERLAY_KINDS = ['consent', 'chat', 'survey', 'newsletter', 'promo_bar', 'warning', 'modal', 'header', 'other'] as const;
const OverlayKindSchema: z.ZodType<OverlayKind> = z.enum(OVERLAY_KINDS);
const overlayId = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, 'ids are short words like ov1 or n12');

export const OverlayEvidenceSchema: z.ZodType<OverlayEvidence> = z.object({
  id: overlayId,
  kind_hint: OverlayKindSchema,
  label: text(400),
  position: text(120),
  size: text(120),
  opened_by_itself: z.boolean(),
  class_words: z.array(text(40)).max(12),
  iframe_kind: text(40).optional(),
});

export const OverlayButtonEvidenceSchema: z.ZodType<OverlayButtonEvidence> = z.object({
  id: overlayId,
  tag: text(32),
  label: text(400),
  visible_text: text(400),
  position_in_overlay: text(120),
  size: text(80),
  class_words: z.array(text(40)).max(12),
  link_target: z.enum(['same page', 'this website', 'another website']).optional(),
  form_submit: z.boolean().optional(),
  aria_expanded: z.boolean().optional(),
});

export const OverlayCloseBody = z.object({
  overlay: OverlayEvidenceSchema,
  candidates: z.array(OverlayButtonEvidenceSchema).max(40),
});

/** First zod issues as short `path: message` lines (never echoes values). */
export function zodIssues(err: z.ZodError): string[] {
  return err.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`);
}
