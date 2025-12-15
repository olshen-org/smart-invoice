## Smart Invoice Design System

### Palette

| Token | Value | Usage |
| --- | --- | --- |
| `--background` | `hsl(212 33% 98%)` | App shell background, neutral canvas |
| `--foreground` | `hsl(223 47% 11%)` | Primary text |
| `--primary` | `hsl(217 91% 60%)` | Buttons, key highlights |
| `--secondary` | `hsl(213 32% 94%)` | Secondary panels, filters |
| `--accent` | `hsl(217 92% 95%)` | Soft highlight surfaces |
| `--muted` | `hsl(220 18% 92%)` | Table rows, dividers |
| `--destructive` | `hsl(2 74% 55%)` | Dangerous actions |

Gradients:

- Accent gradient: `linear-gradient(120deg, #4f8df6, #7b6dff, #b66dff)`
- Shell wash: `radial-gradient(circle at 10% 20%, hsla(217,91%,60%,0.08), transparent 55%)`

### Typography

- Typeface stack: `Rubik`, `Heebo`, system sans
- Sizes: `h1` 32/40, `h2` 24/32, body 16/26, helpers 14/22
- Tracking: tight on headings (`tracking-tight`), normal on body

### Spacing & Radii

- Base unit: `--space-unit = 12px`
- Common spacing multiples: 12, 24, 36
- Radii: cards/buttons `1rem (16px)`, icon containers `999px`

### Elevation

- Cards: `box-shadow: 0 25px 60px rgba(15,23,42,0.08)`
- Buttons: `0 15px 30px rgba(79,141,246,0.35)`
- Glass panels: `backdrop-filter: blur(18px)` + border `rgba(255,255,255,0.6)`

### Components

- **Buttons**: Rounded (`rounded-xl`), gradient default, outlined variant uses semi-transparent glass with subtle border, transitions `duration-200`.
- **Cards**: Use `.glass-panel` helper or card component (frosted background, border `white/60`).
- **Sidebar**: White/glass background with inset highlight, accent badge for active nav.
- **Timeline chips**: Use accent backgrounds + `w-10 h-10` icon circles.

### Usage Notes

- Maintain RTL direction across components (`dir="rtl"` and Tailwind where needed).
- Keep layout rhythm consistent: sections separated by multiples of 24px, internal grid gutters 24px.
- Use accent gradient for the highest emphasis only (CTA buttons, hero highlights). Secondary actions rely on outline or muted fills.

