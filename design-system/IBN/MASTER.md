# IBN design system (master)

Source of truth for the visual rules of the IBN web client. Tokens live in `src/index.css`; this file records the rules that go with them. Page-specific overrides go in `design-system/IBN/pages/<page>.md` and win over this file.

Written from the existing tokens and the ui-ux-pro-max checks. It deliberately does not use the skill's generated gold/purple palette or IBM Plex Sans.

## Direction

Minimal, Swiss-style banking UI: clean, spacious, high contrast, functional. Borderless page sections; lists and landings keep their border. Amount-first "slip" look for confirmations, results and receipts. No playful effects, no gradients, no emoji as icons.

## Language and direction

- Persian (default, RTL) and English (LTR) are equal. Every string goes through i18n.
- Use logical CSS only: `ps/pe/ms/me`, `start/end`. Never `ml/mr/pl/pr/left/right/text-left/text-right`.
- Direction-bearing icons (chevrons, arrows) must flip in RTL: `rtl:rotate-180`, or swap the icon. Combine with open/close rotations via a state variant, which wins on specificity (see `nav-main.tsx`).
- Numeric, code and email fields use `dir="ltr"`.
- Fonts: Dana Pro FaNum leads in Persian, Inter leads in English.

## Color (semantic tokens only, no raw hex in components)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| background | #eef3fa | #151826 | page |
| card | #ffffff | #1c2033 | surfaces |
| foreground | #1f2333 | #e8ecf4 | text |
| muted-foreground | #5b6075 | #9aa1b8 | secondary text (5.1:1+ in both themes) |
| primary | #ec6b06 | #ec6b06 | brand fill; text on it is `primary-foreground` |
| brand-text | #b84f00 | n/a | brand colour as text on light (5:1) |
| destructive / success / warning / info | see index.css | see index.css | status text, all above 4.5:1 on cards |
| input | #7a8196 | #6a7396 | control borders, at least 3:1 on the card |
| ring | #007bc3 | #4db0e8 | focus ring |

Rules: body text 4.5:1 minimum; control borders and meaningful icons 3:1; decorative dividers (`border`) may be lighter. Check dark mode separately, never assume light values carry over. Colour is never the only carrier of meaning (pair it with text or an icon).

## Typography

- Base 16px; inputs are `text-base` on mobile (stops iOS zoom), `md:text-sm` from the md breakpoint.
- Nothing below 12px (`text-xs`), including SVG chart labels.
- Line height around 1.5 for body text.

## Touch and interaction

- Touch targets are at least 44px on coarse pointers. The shared `Button` sizes already grow with `pointer-coarse:`; do not override a button's height or width with a smaller fixed size on touch. When a row needs a compact control on desktop, use `size-11 md:size-7`.
- Every icon-only control has an `aria-label`; its icon has `aria-hidden="true"`.
- Hover is never the only way to reach an action. Pressed or hover feedback uses colour or opacity, not layout shifts. Transitions 150 to 300ms; respect `prefers-reduced-motion` (handled in `src/index.css`).
- Disabled controls use the real `disabled` attribute.

## Forms and feedback

- Visible `Label` with `htmlFor` for every field. A placeholder is an example, never the label.
- Field errors sit directly under the field, as `<p id="x-error" role="alert">`, and the input carries `aria-invalid` plus `aria-describedby="x-error"` while the error shows.
- Say what to do next in error text, not only what went wrong.
- Dialogs always have a title (`DialogTitle`); confirmations of money movement keep their guards.

## Layout

- Mobile first; check 375, 768, 1024 and 1440px. No horizontal page scroll. Wide data (tables, the monthly calendar) scrolls inside its own `overflow-x-auto` wrapper.
- Spacing on a 4/8px rhythm. Use shadcn primitives from `src/components/ui` before writing custom ones.

## Pre-delivery checklist

- [ ] Persian and English both read correctly; RTL checked (icons flip, no physical CSS)
- [ ] Light and dark contrast checked
- [ ] Touch targets at least 44px on a phone; no horizontal scroll at 375px
- [ ] Icon-only buttons labelled; errors announced and linked to their field
- [ ] Reduced motion respected; focus ring visible on every control
- [ ] `npm run lint` and `npm run build` pass
