/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		fontFamily: {
  			heading: ['var(--font-heading)'],
  			body: ['var(--font-body)']
  		},
  		borderRadius: {
  			none: '0',
  			sm: 'calc(var(--radius) - 4px)',
  			md: 'calc(var(--radius) - 2px)',
  			lg: 'var(--radius)',
  			xl: 'calc(var(--radius) + 4px)',
  			'2xl': 'calc(var(--radius) + 12px)',
  			'3xl': 'calc(var(--radius) + 20px)',
  			pill: '9999px',
  			full: '9999px'
  		},
  		transitionTimingFunction: {
  			editorial: 'cubic-bezier(0.16, 1, 0.3, 1)',
  			'editorial-out': 'cubic-bezier(0.7, 0, 0.84, 0)'
  		},
  		transitionDuration: {
  			fast: '160ms',
  			base: '320ms',
  			slow: '640ms',
  			reveal: '800ms'
  		},
  		fontSize: {
  			// Display / heading scale (Bebas Neue). Paired line-heights tuned for condensed sans.
  			'display-xl': ['clamp(3.5rem, 9vw, 8rem)', { lineHeight: '0.9', letterSpacing: '0.02em' }],
  			'display':    ['clamp(2.75rem, 7vw, 6rem)',  { lineHeight: '0.95', letterSpacing: '0.02em' }],
  			'h1':         ['clamp(2.25rem, 5vw, 4.5rem)', { lineHeight: '1.02', letterSpacing: '0.02em' }],
  			'h2':         ['clamp(1.875rem, 4vw, 3.5rem)', { lineHeight: '1.05', letterSpacing: '0.02em' }],
  			'h3':         ['clamp(1.5rem, 3vw, 2.25rem)', { lineHeight: '1.1', letterSpacing: '0.02em' }],
  			'h4':         ['1.5rem',   { lineHeight: '1.15', letterSpacing: '0.02em' }],
  			// Body scale (Inter). Floor raised from 10px to 11px in the UI for WCAG.
  			'body-lg':    ['1.125rem', { lineHeight: '1.65' }],
  			'body':       ['1rem',     { lineHeight: '1.6' }],
  			'body-sm':    ['0.875rem', { lineHeight: '1.55' }],
  			'body-xs':    ['0.75rem',  { lineHeight: '1.5' }],
  			// Editorial accents — always uppercase + tracked.
  			'eyebrow':    ['0.625rem', { lineHeight: '1', letterSpacing: '0.35em' }],
  			'micro':      ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.18em' }],
  			'caption':    ['0.5625rem', { lineHeight: '1.4', letterSpacing: '0.25em' }]
  		},
  		spacing: {
  			// 8px baseline rhythm tokens for page-level composition.
  			'gutter':     '1rem',     // 16
  			'gutter-lg':  '2rem',     // 32
  			'rhythm':     '0.5rem',   // 8
  			'rhythm-2':   '1rem',     // 16
  			'rhythm-3':   '1.5rem',   // 24
  			'rhythm-4':   '2rem',     // 32
  			'rhythm-6':   '3rem',     // 48
  			'rhythm-8':   '4rem',     // 64
  			'section-sm': '3rem',     // 48
  			'section':    '5rem',     // 80
  			'section-lg': '7.5rem'    // 120
  		},
  		maxWidth: {
  			'measure':    '38rem',    // ~65ch for optimal reading
  			'measure-lg': '48rem',    // long-form prose
  			'content':    '72rem'     // standard section container (6xl)
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
