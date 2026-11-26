# Prompt Vault brand and design specification

**Product:** Prompt Vault — a private, searchable home for reusable prompts and small-team collaboration.

**Design direction:** Calm Creative Workbench. Premium and approachable, with a dreamy charcoal workspace and warm paper light theme. The product should feel like a practical daily tool, not an admin template or generic AI landing page.

## Existing identity assets

- **Wordmark:** “Prompt Vault” text in `src/components/Layout.tsx`; preserve its name and current product positioning.
- **Mark:** Existing Lucide `Vault` glyph in `src/components/Layout.tsx`; retain it rather than substituting an invented logo.
- **Favicon:** Inline vault/folio SVG in `index.html`; keep consistent with the in-app mark.
- **UI reference:** Current production app at `https://prompt-vault-orpin.vercel.app/`; inspect the current interface in the running browser session rather than using customer data in a committed screenshot.
- **Typography loading:** Existing Google Fonts declaration in `index.html` for Bricolage Grotesque, DM Sans, and IBM Plex Mono.

## Tokens

### Dark theme (default)

| Role | Value |
| --- | --- |
| Background | `#171916` |
| Surface | `#1E211E` |
| Raised surface | `#272B27` |
| Border | `#3A4039` |
| Primary text | `#E9E4D9` |
| Muted text | `#B0ADA3` |
| Primary accent / organized state | `#A8C59A` |
| Attention / destructive intent | `#E88970` |
| Highlight | `#D9B765` |
| Information | `#8ABCC0` |

### Light theme

| Role | Value |
| --- | --- |
| Background | `#FBF3E8` |
| Surface | `#FFFCF5` |
| Raised surface | `#F3EADB` |
| Border | `#E5D9C7` |
| Primary text | `#292820` |
| Muted text | `#706E61` |
| Primary accent | `#28513F` |

## Typography and layout

- Bricolage Grotesque: prominent page titles and selected section headings.
- DM Sans: body copy, controls, navigation, and metadata.
- IBM Plex Mono: prompt/code previews only.
- Use a 4px spacing rhythm. Keep dense data and prompt previews legible; use generous spacing only for hierarchy, not to waste working area.
- Use 10–12px radii for controls, 16px for grouped cards, and up to 24px for a single brand-level surface.
- Use subtle depth; grain/glow is limited to brand-level surfaces and must not reduce text clarity.

## Interaction and accessibility

- Motion is short and functional (feedback, selection, open/close), with a reduced-motion alternative.
- Keep semantic status labels in addition to color, keyboard-visible focus, accessible names for icon-only controls, and clear empty/loading/error/disabled states.
- Preserve private-by-default content and explicit sharing. The public/open-source source repository does not make a user's prompt content public.
- Keep unavailable AI states truthful; never fabricate output.
- Do not add analytics, testimonials, service claims, or sample user data not present in the product.
