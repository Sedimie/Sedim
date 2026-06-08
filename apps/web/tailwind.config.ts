import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './content/**/*.{md,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FAFAF9',
        surface: '#F5F5F4',
        'surface-2': '#E7E5E4',
        text: '#1C1917',
        muted: '#78716C',
        'muted-light': '#A8A29E',
        primary: '#292524',
        'primary-fg': '#FAFAF9',
        'primary-subtle': '#F5F5F4',
        accent: '#C2410C',
        'accent-hover': '#9A3412',
        'accent-subtle': '#FFF7ED',
        secondary: '#57534E',
        border: '#D6D3D1',
        'border-dark': '#A8A29E',
        'code-bg': '#1C1917',
        'code-fg': '#E7E5E4',
      },
      fontFamily: {
        display: ['Instrument Serif', 'Georgia', 'serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(28, 25, 23, 0.05)',
        'md': '0 4px 12px rgba(28, 25, 23, 0.08)',
        'lg': '0 8px 30px rgba(28, 25, 23, 0.12)',
        'xl': '0 20px 50px rgba(28, 25, 23, 0.15)',
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '14px',
        'xl': '18px',
      },
      spacing: {
        '18': '4.5rem',
        '24': '6rem',
      },
    },
  },
  plugins: [],
}

export default config