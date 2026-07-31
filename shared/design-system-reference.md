# Design System Reference

## Architecture
- **Component Model**: Atomic design (atoms → molecules → organisms → templates → pages)
- **Framework**: React 18+ with TypeScript strict mode
- **Styling**: Tailwind CSS utility classes with design tokens
- **Layout**: CSS Grid and Flexbox with responsive breakpoints
- **Animation**: CSS transitions and Tailwind `motion-*` utilities

## Design Tokens
Location: `packages/ui/src/tokens/`

### Typography
- Font family: Inter (UI), JetBrains Mono (code)
- Scale: 12/14/16/18/20/24/30/36/48px

### Spacing
- Base unit: 4px (Tailwind default)
- Scale: 2/4/8/12/16/24/32/48/64px

### Colors
- Primary: indigo-600 (#4F46E5)
- Neutral: gray-50 to gray-900
- Semantic: green (success), red (error), amber (warning), blue (info)

## Components
Location: `packages/ui/src/components/`

## WCAG Compliance
- Target: WCAG 2.1 Level AA
- Color contrast minimum: 4.5:1
- Focus indicators on all interactive elements
- Keyboard navigable by default
