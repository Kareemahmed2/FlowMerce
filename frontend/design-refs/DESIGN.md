---
name: SaaS Commerce Modern
# Extracted from Stitch project "FlowMerce Multi-Merchant Platform" (8839380850043696138)
# Phase 1 will translate these tokens into globals.css + tailwind.config.ts
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45474c'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#545f73'
  primary: '#091426'
  on-primary: '#ffffff'
  primary-container: '#1e293b'
  on-primary-container: '#8590a6'
  inverse-primary: '#bcc7de'
  secondary: '#4b41e1'
  on-secondary: '#ffffff'
  secondary-container: '#645efb'
  on-secondary-container: '#fffbff'
  tertiary: '#00190e'
  on-tertiary: '#ffffff'
  tertiary-container: '#00301e'
  on-tertiary-container: '#00a472'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
# Override (brand) colors used by Stitch:
#   primary  override: #1e293b (deep navy)
#   secondary override: #4f46e5 (dynamic indigo) -- core action color
#   tertiary  override: #10b981 (emerald) -- success/positive
#   neutral   override: #f8fafc (cool gray background)
typography:
  display-lg:    { fontFamily: Inter, fontSize: 48px, fontWeight: '700', lineHeight: 56px, letterSpacing: -0.02em }
  headline-lg:   { fontFamily: Inter, fontSize: 32px, fontWeight: '600', lineHeight: 40px, letterSpacing: -0.01em }
  headline-md:   { fontFamily: Inter, fontSize: 24px, fontWeight: '600', lineHeight: 32px }
  headline-sm:   { fontFamily: Inter, fontSize: 20px, fontWeight: '600', lineHeight: 28px }
  body-lg:       { fontFamily: Inter, fontSize: 18px, fontWeight: '400', lineHeight: 28px }
  body-md:       { fontFamily: Inter, fontSize: 16px, fontWeight: '400', lineHeight: 24px }
  body-sm:       { fontFamily: Inter, fontSize: 14px, fontWeight: '400', lineHeight: 20px }
  label-md:      { fontFamily: Inter, fontSize: 14px, fontWeight: '600', lineHeight: 16px, letterSpacing: 0.01em }
  label-sm:      { fontFamily: Inter, fontSize: 12px, fontWeight: '500', lineHeight: 14px, letterSpacing: 0.02em }
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

Engineered for a sophisticated multi-merchant ecosystem, balancing the authority of an
enterprise platform with the agility of a modern startup. The visual narrative centers on
**trust, scalability, and precision**. Style is **Modern Corporate**: heavy whitespace, a
disciplined palette, data density without clutter. The aesthetic should feel "invisible" yet
premium — prioritizing the merchant's content and metrics above all else.

## Colors
- **Primary (Deep Navy `#1E293B`):** structure, navigation, primary text — permanence & authority.
- **Secondary (Dynamic Indigo `#4F46E5`):** core action color — primary CTAs, active/focus states.
- **Tertiary (Emerald `#10B981`):** success states, positive growth, completed transactions.
- **Neutral (Cool Gray `#F8FAFC`):** light airy background; lets cards pop via subtle contrast.

## Typography
**Inter** throughout. Hierarchy by weight: headlines SemiBold (600)/Bold (700); body Regular (400);
table/caption labels Medium (500)/SemiBold (600) at smaller scales.

## Layout & Spacing
Fluid grid for dashboards; fixed grid (max-width 1440px) for storefront. 12-column desktop.
Breakpoints: Mobile (<640px), Tablet (640–1024px), Desktop (>1024px). 8px base unit (4px half-step).
On mobile, side-by-side cards stack; top nav -> bottom bar / hamburger.

## Elevation & Depth
Tonal layering + ambient shadows. Background `#F8FAFC`; cards pure white `#FFFFFF`.
- **Low (resting cards):** `0 1px 3px rgba(30,41,59,.05), 0 1px 2px rgba(30,41,59,.03)`
- **High (modals/dropdowns):** `0 10px 15px -3px rgba(30,41,59,.1), 0 4px 6px -2px rgba(30,41,59,.05)`
Avoid heavy borders; use 1px `#E2E8F0` strokes where shadows aren't appropriate (table cells).

## Shapes
Consistently **Rounded**. Buttons/inputs/small widgets **8px**. Containers/cards **12px**.
Badges/tags/search bars **pill (9999px)**.

## Components
- **Buttons** — Primary: solid `#4F46E5`, white text, 8px radius. Secondary: ghost/outline, `#1E293B`
  text+stroke. Tertiary/Ghost: no border, `#4F46E5` text.
- **Cards** — white bg, 12px radius, low-elevation shadow, generous padding (24–32px).
- **Data Tables** — dense & legible; zebra `#F8FAFC` or 1px dividers; headers all-caps bold `label-sm`.
- **Status Badges** — light tint bg + saturated text: Pending (amber), Shipped (blue), Delivered (emerald).
- **Visual Builder** — active state 2px indigo border + drag handles.

## Reference screens (frontend/design-refs/)
| # | Screen | Maps to app route |
|---|--------|-------------------|
| 01 | Customer Storefront Home | `store/[slug]/page.tsx` |
| 02 | Merchant Dashboard Overview | `dashboard/page.tsx` |
| 03 | Products Management | `dashboard/products/page.tsx` |
| 04 | Orders Management | `dashboard/orders/page.tsx` |
| 05 | Analytics Deep Dive | `dashboard/analytics/page.tsx` |
| 06 | Admin Dashboard Overview | `admin/page.tsx` |
| 07 | Design Studio: Page Editor | `dashboard/design/[pageId]/page.tsx` |
| 08 | Design Studio: Theme Settings | `dashboard/design/*` |
| 09 | Design Studio: Component Inspector | `dashboard/design/*` |
| 10 | Design Studio: AI-Integrated Editor | `dashboard/design/*` |
| 11 | Design Studio: AI Assistant | AiChatPanel context |
| 12 | Onboarding: General Info | `onboarding/page.tsx` (step) |
| 13 | Onboarding: Add First Product | `onboarding/page.tsx` (step) |
| 14 | Onboarding: Payment Setup | `onboarding/page.tsx` (step) |
| 15 | Onboarding: Review & Publish | `onboarding/page.tsx` (step) |
