---
name: Vaidik Milan
description: A warm, free matrimonial workspace with the character of an Indian family album.
colors:
  primary: "#68384c"
  primary-hover: "#532b3c"
  primary-foreground: "#fff"
  secondary: "#f0e8eb"
  secondary-hover: "#f7f0f3"
  accent: "#f3eaf0"
  background: "#faf9f6"
  foreground: "#2d2630"
  card: "#fff"
  muted: "#f0eeea"
  muted-foreground: "#68616a"
  border: "#dedbd7"
  input: "#d8d2d5"
  ring: "#9b6e80"
  destructive: "#a73737"
  card-border: "#e2dcdd"
  card-border-hover: "#b293a1"
  secondary-border: "#ded0d6"
  field-focus: "#8c5d73"
  field-placeholder: "#777079"
  divider: "#e3dddc"
  community-text: "#75495c"
  free-strip: "#f0e7eb"
  free-strip-text: "#684455"
  footer: "#f2edee"
  portrait-paper: "#ede4dc"
  no-photo: "#eee7eb"
  no-photo-foreground: "#745065"
  demo-label: "#fffffff0"
  demo-label-foreground: "#6c5549"
  member-label-foreground: "#495f48"
  status-pending: "#f1ede7"
  status-pending-foreground: "#755d39"
  status-accepted: "#e7efe8"
  status-accepted-foreground: "#3f664c"
  status-declined: "#eee7e9"
  status-declined-foreground: "#765964"
  chat-received: "#eee5e9"
  overlay: "#30202b70"
typography:
  display:
    fontFamily: "Cormorant Garamond, serif"
    fontSize: "2.8rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-.025em"
  display-hindi:
    fontFamily: "Noto Serif Devanagari, serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: "-.02em"
  headline:
    fontFamily: "Cormorant Garamond, serif"
    fontSize: "2.7rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-.025em"
  headline-hindi:
    fontFamily: "Noto Serif Devanagari, serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.52
    letterSpacing: "-.02em"
  title:
    fontFamily: "Cormorant Garamond, serif"
    fontSize: "1.65rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-.015em"
  body:
    fontFamily: "DM Sans, Noto Sans Devanagari, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  body-hindi:
    fontFamily: "Noto Sans Devanagari, DM Sans, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  label:
    fontFamily: "DM Sans, Noto Sans Devanagari, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.6
  button:
    fontFamily: "DM Sans, Noto Sans Devanagari, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  base: ".75rem"
  field: "7px"
  card: "12px"
  tag: "5px"
  chip: "20px"
  interest: "6px"
  upload: "8px"
  avatar: "9px"
  chat: "11px"
  circle: "50%"
spacing:
  icon-gap: "8px"
  action-gap: "9px"
  compact: "12px"
  card-inline: "17px"
  field-separation: "20px"
  grid-gap: "22px"
  panel: "24px"
  sheet-inline: "27px"
  page-inline: "30px"
  discovery-gap: "37px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.button}"
    rounded: "{rounded.field}"
    padding: "11px 19px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-foreground}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.field}"
    padding: "11px 19px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
    textColor: "{colors.primary}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    padding: "3px"
  input-field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "11px 12px"
  community-chip:
    backgroundColor: "transparent"
    textColor: "#73626d"
    rounded: "{rounded.chip}"
    padding: "7px 15px"
  community-chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.chip}"
    padding: "7px 15px"
  profile-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
  demo-label:
    backgroundColor: "{colors.demo-label}"
    textColor: "{colors.demo-label-foreground}"
    rounded: "{rounded.tag}"
    padding: "5px 8px"
  status-accepted:
    backgroundColor: "{colors.status-accepted}"
    textColor: "{colors.status-accepted-foreground}"
    rounded: "{rounded.tag}"
    padding: "3px 8px"
  chat-received:
    backgroundColor: "{colors.chat-received}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.chat}"
    padding: "12px 15px"
  chat-sent:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.chat}"
    padding: "12px 15px"
---

# Design System: Vaidik Milan

## Overview

**Creative North Star: "The Indian Family Album"**

Vaidik Milan pairs the warmth of a family album with a light, functional matching workspace. Plum accents, paper-like backgrounds, fine dividers and serif identity type make profiles feel personal. Portraits carry the visual weight; filters and profile facts stay immediately useful. The original Vaidik Milan identity is the brand authority.

Hindi is the default language, with an English option. Devanagari receives its own sans and serif fonts, sizes and line heights. Free access, visible fictional-demo labels and explicit sharing consent are durable product commitments that shape interface copy and hierarchy.

This document is source-derived from `app/globals.css`, `app/milan.tsx` and the local UI primitives. Responsive behavior and image framing described here are **unrendered assumptions**: no browser screenshots or computed-style sampling were available. The parent implementation reports that typecheck and the Worker build pass; those checks do not establish visual rendering. Frontmatter values record current source, including the final CSS overrides. Sidecar tonal ramps are synthesized panel previews, not application tokens.

**Key Characteristics:**

- Warm plum and off-white paper with white working surfaces.
- Serif identity and headings with readable bilingual sans text.
- Portrait-led profiles with compact facts and visible provenance.
- Flat surfaces at rest; stronger depth reserved for overlays.
- Immediate community browsing and separate community and gotra controls.

## Colors

The palette is muted and warm, with one primary plum accent and restrained semantic colors.

### Primary

- **Family Album Plum** (`primary`): brand, primary actions, active navigation, selected chips, bookmarks and sent chat bubbles. `primary-hover` deepens action hover; `primary-foreground` supplies white text.
- **Soft Plum Paper** (`secondary`, `accent`, `secondary-hover`): counters, gentle emphasis and secondary-button hover. These support the primary accent rather than introducing another identity color.

### Neutral

- **Warm Paper** (`background`): the application canvas. **Clean Album Page** (`card`) holds profiles, fields, forms and sheets. **Ink** (`foreground`) carries the main reading layer.
- **Quiet Paper and Ink** (`muted`, `muted-foreground`): supporting UI surfaces and lower-emphasis text. `border`, `input`, `card-border`, `secondary-border` and `divider` keep grouping visible without heavy outlines.
- **Portrait Paper** (`portrait-paper`, `no-photo`, `no-photo-foreground`): image and no-photo backgrounds. **Translucent Label Paper** (`demo-label`) keeps provenance legible over a portrait.
- `free-strip` and `footer` provide light tonal bands; `overlay` dims the page while a dialog or sheet has focus.

Semantic colors remain narrow in purpose: `destructive` is for destructive states; pending, accepted and declined colors label interest state. A member label's green is a profile-type distinction, not a claim of independent verification.

**The One Accent Rule.** Use the existing plum for identity and selection. Reserve green, ochre and destructive red for their current status roles.

## Typography

**Display Font:** Cormorant Garamond with serif fallback; Noto Serif Devanagari with serif fallback for explicitly styled Hindi headings.

**Body Font:** DM Sans followed by Noto Sans Devanagari and sans-serif; Hindi reverses the first two families. No distinct mono role is implemented.

**Character:** Serif headings lend a personal, editorial voice. Sans text carries browsing, forms and conversations. There is no uniform mathematical type scale; roles and language determine size.

### Hierarchy

- **Display:** the compact introduction uses `display` / `display-hindi`. Its emphasis is italic and slightly lighter (500). At the mobile breakpoint the English size becomes (2.85rem) and Hindi becomes (1.95rem), with Hindi line height (1.6).
- **Headline:** focused pages use `headline` / `headline-hindi`; mobile sizes become (2.2rem) / (1.7rem). The results heading has its own English (1.95rem, line height 1.25) and Hindi (1.4rem, line height 1.7) styles; the final mobile English override is (1.65rem).
- **Title:** profile names use `title`, changing to (1.55rem) below the medium layout breakpoint and (1.9rem) in the single-column phone layout. The profile-name rule does not explicitly switch to Noto Serif in Hindi; preserve that source distinction.
- **Body:** the base uses `body` / `body-hindi`. Profile facts are denser (12–14px) according to viewport; longer introductions use line height (1.8) and preserve line breaks.
- **Label:** field labels use `label`; buttons use the slightly heavier `button` role. Navigation is (15px) at desktop, (13px) at mobile and (12px) on narrow phones.
- **Brand:** the English wordmark is (1.8rem, 700, line height 1.1); Hindi is (1.35rem, 700, line height 1.6). Its small descriptor is tracked, with language-specific spacing.

**The Script Respect Rule.** Apply the existing language-specific font order and heading metrics whenever adding a bilingual heading. Allow Hindi labels to wrap without clipping.

## Layout

The main container is centered and limited to (1400px), with desktop inline padding from `page-inline`. The header is (92px) tall. The discovery layout combines a (230px) sidebar with a flexible results region and `discovery-gap`; the sidebar uses a fine right divider. Profiles form three columns with `grid-gap`. The shortlist forms four columns on wide screens. The profile editor pairs a form region of up to (760px) with a supporting aside.

Responsive source behavior is **unrendered**:

| Source breakpoint | Implemented change |
| --- | --- |
| At least 1600px | Header inline padding aligns to a 1340px interior. |
| At most 1200px | Sidebar becomes 215px; discovery profiles become two columns; shortlist becomes three. |
| At most 960px | Header becomes 84px; sidebar becomes 200px; page gutters become 25px; intro aside is hidden. |
| At most 760px | Header wraps with a 51px navigation row; page gutters become 20px; sidebar is replaced by a left filter sheet; profile editor stacks; shortlist becomes two columns. |
| At most 500px | Profile and shortlist grids become one column; fields stack; form-step labels stack beneath their numbers. |

The final intro override removes the explicit heading break on desktop and restores it at the mobile breakpoint: a compact single-line desktop composition and two-line mobile composition are intended, subject to actual available width. Intro padding is (25px 0 23px), changing to (25px 0 22px) on mobile.

Card portraits have aspect ratio (1.25) on desktop and (1.12) at the mobile breakpoint. The detail portrait remains square. Demo imagery is one generated three-column, two-row image: its absolutely positioned image is (300%) of the portrait width, with each selected column translated by negative one-third of its own width and the lower row by (-50%) of its own height. Keep that transform relationship when reusing the asset. Rendering and face framing remain unverified.

Fields, captions and facts use compact internal gaps; larger gaps separate regions. Community chips remain horizontally scrollable. Do not add a large promotional block ahead of the working filters on this surface.

## Elevation & Depth

The workspace uses tonal layering, fine borders and clipped photographs. Profile cards are flat at rest; hover changes their border over (180ms) without adding lift. Depth becomes structural when a sheet or dialog overlays the workspace.

### Shadow Vocabulary

- **Slider thumb:** `0 1px 4px #4f2d4540`, distinguishing the draggable control.
- **Detail, help and chat sheets:** `-12px 0 35px #36223020`, separating the right panel from the dimmed page.
- **Interest dialog:** `0 20px 60px #36223035`, supporting the central conversation-start layer.

The sheet primitive opens over (500ms) and closes over (300ms) with ease-in-out and directional movement. A loading indicator rotates over (1s) linearly. Reduced motion disables smooth scrolling and reduces animation and transition durations to (.001ms). These motion rules are source-derived and unrendered.

**The Flat Workspace Rule.** Keep resting profile surfaces flat. Use the established shadows for controls and overlays where depth explains interaction.

## Shapes

The form language is gently curved and clearly bounded. Fields and primary actions use `field`; main cards and forms use `card`; compact badges use `tag`; community chips use `chip`. Bookmark buttons and step indicators are circular. Portraits clip to their parent surface; cards hide overflow. The CSS base radius is `base`, with local primitive radius calculations and explicit component radii coexisting in source. Do not replace these with a single universal corner value.

## Components

### Buttons

Primary and secondary actions are compact and confident: minimum height (44px), a one-pixel border, `field` corners and `button` typography. The primary uses plum with white text and deepens on hover. The secondary uses a white surface, plum text and a soft plum hover surface. Text actions are unfilled and underline on hover. Disabled buttons use opacity (.55) and a not-allowed cursor. All native buttons and links receive a visible (3px) focus outline with (3px) offset using `ring`.

The card's secondary action is smaller (39px minimum height; 8px 10px padding), becoming (43px) high on narrow phones. The adjoining heart action is (42px) wide with `interest` corners; it becomes (47px) on narrow phones. Destructive confirmation remains visually separate from the main plum action.

### Chips

Community chips have transparent resting surfaces, rounded ends and `community-chip` padding. Hover uses soft plum paper; selection uses solid plum with white text. The row scrolls rather than squeezing or truncating community names. Interest status tags use semantic background/text pairs and `tag` corners.

### Cards / Containers

Profiles are portrait-led, white, bordered and clipped with `card` corners. Desktop body padding is (19px 17px 17px), with responsive adjustments already defined. A name, age/height/status line, separate community/gotra line, three icon facts and a restrained action row form the reading order. The card hover changes to `card-border-hover`. Demo/member labels remain over the upper-left portrait; the circular bookmark sits upper-right.

Empty states use a dashed border, white surface and generous centered space. Forms use the same white surface and gently curved perimeter. They belong to the functional workspace, with more breathing room than a profile card.

### Inputs / Fields

Fields use a white fill, one-pixel `input` border, `field` corners, (11px 12px) padding and a (44px) minimum height. Focus changes the border to `field-focus`; keyboard focus retains the global `ring` outline. Search uses an icon inside a bordered wrapper and a (2px) focus-within outline offset by (2px). Select triggers follow the same field geometry, allow wrapping and use their primitive focus ring. Textareas preserve vertical resizing except the chat composer.

Errors have warm red text and a pale error surface; publication consent is a visibly labelled checkbox at the final stage. Account contact details are not presented as public profile facts.

### Navigation

Desktop navigation is an understated row of line tabs. Active tabs use plum text and a (3px) bottom line; inactive tabs use muted ink. Mobile navigation occupies its own full-width row and exposes My profile while the separate header profile action is hidden. The language switch stays beside the identity and persists the chosen language.

### Sheets and Conversations

Details, help and messages use right-hand sheets of `min(490px, 100vw)` with scrollable content and bounded action regions. Mobile filters use a left sheet of `min(340px, 95vw)` with a sticky bottom results action. The interest composer is a dialog limited to (520px), with (28px) padding and `card` corners.

Chat bubbles use `chat` corners and (12px 15px) padding, with maximum width (85%). Received messages sit left on soft plum paper; sent messages sit right on solid plum. The composer remains at the bottom. Destructive profile removal and conversation ending use confirmation dialogs.

### Profile Creation and Provenance

The form has three visible stages: basics, family/background, and personal story. Current step numbers use plum circles; completed steps use checks. Photo upload is optional, with an (8px) dashed container. Explicit publishing consent appears before the final primary action.

Fictional generated portraits are labelled in the catalog notice, card badge and detail sheet. Member information is described as self-reported. Community and gotra remain separate controls; unknown and other values are supported. The WhatsApp action opens an invitation composer. These copy commitments must remain visible in any visual expansion of the corresponding flow.

## Do's and Don'ts

### Do:

- **Do** use plum, serif identity type and warm paper surfaces to retain the family-album character.
- **Do** keep community and gotra distinct, immediately available filter concepts.
- **Do** preserve Hindi-specific fonts and metrics, with a visible English switch.
- **Do** keep fictional portrait provenance and member self-reporting clear in the catalog and detail views.
- **Do** keep publishing consent explicit and every matching feature free.
- **Do** preserve the final portrait aspect ratios and three-by-two image translation relationship.
- **Do** verify responsive wrapping and generated-image framing in a browser before claiming rendered visual validation.

### Don'ts:

- **Don't** add paid contact gates, premium badges or upsell surfaces.
- **Don't** imply that a demo person is a real member or that a member label means independently verified identity.
- **Don't** infer community or gotra from a surname or turn a filter into religious certification.
- **Don't** populate the catalog with scraped social caste, gotra or contact information.
- **Don't** replace the original Vaidik Milan identity with a reference site's logo or name.
- **Don't** add heavy shadows to resting profile cards or obscure the working filters with an oversized introduction.

## Revision: profile safety and free access
The existing visual identity is preserved. A larger free strip states ₹0 member fees before the working surface. The directory is reachable from community browsing and the footer, with Hindi/English name search and independent community/gotra selection. The editor adds an OTP status panel, disabled permanent identity fields after publication, private reference fieldsets, five fixed photo slots and required terms acceptance. The daily feed counter states its India-midnight reset and that filters search this feed. Profile detail shows a photo gallery, accurately limited OTP/reference labels and block/report actions. The legal page is a readable single-column Hindi document with an English summary and public-launch draft status.

Source-level checks and server-render/integration tests cover the new surfaces; no browser screenshot validation was performed for this revision.

## Administration workspace
The /admin workspace uses the existing warm neutral and plum palette in Operate mode. Sans headings at 27px (23px on mobile), section headings at 19px, 15px body, 14px data, and 12–13px secondary dates deliberately replace the public site's large serif headings. Real members lead the overview, fictional accounts are opt-in, and each username links to a dedicated detail page. Profile preview uses the public profile-card styles. Destructive actions and password setup live below the primary reading flow. Mobile lists become stacked rows and member detail collapses to one column. Background neutrals #f1eeeb and #faf7f8 and publication status colors #eff5ef/#cedfce supplement the existing palette.
