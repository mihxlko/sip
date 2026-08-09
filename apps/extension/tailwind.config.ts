import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx,html}', '../../packages/ui/src/**/*.{ts,tsx}'],

  // Light/dark driven by data-theme="dark" on <html>.
  // System preference is handled purely in CSS via the @media block in tokens.css,
  // so Tailwind dark: variants correctly track [data-theme="dark"] only.
  darkMode: ['selector', '[data-theme="dark"]'],

  theme: {
    extend: {

      // ─── breakpoints ───────────────────────────────────────────────────────
      // Two breakpoints, both derived — neither picked off a device table.
      //
      // `wide` is the card layout's. The settings column is capped at 872px and
      // the bottom row's two columns can't shrink below it (250px bottle preview
      // + fixed-width right column). 872 + 24px gutter × 2 = 920 is therefore the
      // exact width at which the desktop layout stops fitting.
      //   < wide  → single column, all five cards stacked
      //   ≥ wide  → the full two-column layout, untouched
      //
      // `dock` is the top nav's own breakpoint, and it is TWO disjoint ranges in
      // one variant (Tailwind emits them as a single comma-separated media query).
      // The nav floats transparently over the page while its brand/links clusters
      // clear the centred card column, and docks into a filled bar where they'd
      // otherwise sit over a card as it scrolls under. Measured clearances, at a
      // 24px minimum:
      //   ≥ 1159      float  — 872px column, clearance grows with the viewport
      //   920 – 1158  DOCK   — clusters overrun the 872px column (−95px at 921)
      //   737 – 919   float  — cards restack to 450px, clearance jumps back to 120
      //   ≤ 736       DOCK   — clusters overrun the 450px column
      // The 920 edge is shared with the card restack, so that flip reads as one
      // event; 1159 and 736 are the nav's own. Re-derive all three if the brand
      // wordmark or the nav links change width.
      screens: {
        wide: '920px',
        dock: [{ min: '920px', max: '1158px' }, { max: '736px' }],
      },

      // ─── colors ────────────────────────────────────────────────────────────
      // All colors reference CSS custom properties so theme switching is
      // automatic at runtime — no JS class swapping needed.
      colors: {
        // surfaces
        'surface-elevated': 'var(--surface-elevated)',
        'surface-raised':   'var(--surface-raised)',
        'surface-primary':  'var(--surface-primary)',
        'surface-base':     'var(--surface-base)',

        // text  (use these instead of raw neutrals to get theme switching)
        'text-primary':   'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary':  'var(--text-tertiary)',
        'text-muted':     'var(--text-muted)',
        'text-error':     'var(--text-error)',
        'text-brand':     'var(--text-brand)',

        // borders  (class: border-border-default, border-border-strong, etc.)
        'border-default':  'var(--border-default)',
        'border-strong':   'var(--border-strong)',
        'border-emphasis': 'var(--border-emphasis)',
        'border-focus':    'var(--border-focus)',

        // interaction overlays  (class: bg-state-hover, etc.)
        'state-hover':    'var(--state-hover)',
        'state-active':   'var(--state-active)',
        'state-selected': 'var(--state-selected)',

        // brand
        'brand-primary':   'var(--brand-primary-500)',
        'brand-secondary': 'var(--brand-secondary-500)',

        // bottle palette (6 color options, keyed by enum value)
        bottle: {
          pink:   'var(--bottle-pink)',
          orange: 'var(--bottle-orange)',
          yellow: 'var(--bottle-yellow)',
          green:  'var(--bottle-green)',
          blue:   'var(--bottle-blue)',
          purple: 'var(--bottle-purple)',
        },
      },

      // ─── typography ────────────────────────────────────────────────────────
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
      },

      // Each size carries its paired line-height from the design system.
      // Font weight is intentionally left out — pair text-* with font-medium
      // or font-semibold explicitly.
      fontSize: {
        sm: ['var(--text-sm)', { lineHeight: 'var(--leading-normal)' }], // 12px / 1.5
        md: ['var(--text-md)', { lineHeight: 'var(--leading-normal)' }], // 14px / 1.5
        lg: ['var(--text-lg)', { lineHeight: 'var(--leading-normal)' }], // 16px / 1.5
        xl: ['var(--text-xl)', { lineHeight: 'var(--leading-tight)'  }], // 80px / 1.25
      },

      fontWeight: {
        medium:   'var(--font-medium)',   // 500
        semibold: 'var(--font-semibold)', // 600
      },

      letterSpacing: {
        tight:  'var(--letter-spacing-tight)',  // -1px
        normal: 'var(--letter-spacing-normal)', //  0px
      },

      // ─── spacing ───────────────────────────────────────────────────────────
      // The design system has two distinct scales that diverge past xs:
      //   gap scale  (10 / 16 / 24 / 30 / 50) — for flex/grid gaps
      //   pad scale  ( 6 /  8 / 16 / 20 / 50) — for element padding
      //
      // Convention:
      //   gap-gap-md  → gap: 16px       (gap utility, gap-md token)
      //   p-pad-xl    → padding: 20px   (p utility,   pad-xl token)
      //   xs          → 4px             (shared, no prefix needed)
      spacing: {
        xs: 'var(--space-gap-xs)', // 4px  (same in both scales)

        // gap scale
        'gap-sm':  'var(--space-gap-sm)',   // 10px
        'gap-md':  'var(--space-gap-md)',   // 16px
        'gap-lg':  'var(--space-gap-lg)',   // 24px
        'gap-xl':  'var(--space-gap-xl)',   // 30px
        'gap-xxl': 'var(--space-gap-xxl)', // 50px

        // padding / inset scale
        'pad-sm':  'var(--space-padding-sm)',  //  6px
        'pad-md':  'var(--space-padding-md)',  //  8px
        'pad-lg':  'var(--space-padding-lg)',  // 16px
        'pad-xl':  'var(--space-padding-xl)',  // 20px
        'pad-xxl': 'var(--space-padding-xxl)', // 50px
      },

      // ─── borders ───────────────────────────────────────────────────────────
      borderWidth: {
        DEFAULT: '1px',
        '0':     '0px',
        '0.5':   'var(--border-width-default)', // border-0.5 → 0.5px hairline
        '2':     '2px',
      },

      // Overrides Tailwind's default scale so rounded-sm/md/lg/xl match the
      // design system rather than Tailwind's arbitrary rem values.
      borderRadius: {
        xs:  'var(--radius-xs)',  //  4px
        sm:  'var(--radius-sm)',  //  6px
        md:  'var(--radius-md)',  //  8px
        lg:  'var(--radius-lg)',  // 10px  main app cards
        xl:  'var(--radius-xl)',  // 16px  notification toast
        xxl: 'var(--radius-xxl)', // 20px  main app overlay
      },

      // ─── shadows ───────────────────────────────────────────────────────────
      boxShadow: {
        subtle:  'var(--box-shadow-subtle)',  // 0 1px 4px  rgba(0,0,0,.03)
        DEFAULT: 'var(--box-shadow-default)', // 0 2px 10px rgba(0,0,0,.05)
        strong:  'var(--box-shadow-strong)',  // 0 4px 10px rgba(0,0,0,.05)
      },
    },
  },

  plugins: [],
} satisfies Config
