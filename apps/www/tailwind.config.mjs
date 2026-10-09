/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,vue,svelte,md,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EAFBF1',
          100: '#CFF5DE',
          DEFAULT: '#20C55C',
          dim: '#189449',
          glow: '#00C65B',
        },
        ink: {
          25: '#FCFDFD',
          50: '#F7F8F9',
          100: '#EEF0F1',
          200: '#E3E6E8',
          300: '#CBD0D3',
          400: '#9AA2A7',
          500: '#6B7378',
          600: '#4B5257',
          700: '#343A3E',
          800: '#202426',
          900: '#121517',
          950: '#0A0C0D',
        },
        danger: '#E0293A',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        serif: ['"Instrument Serif"', 'ui-serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(32,197,92,.35), 0 8px 24px -8px rgba(32,197,92,.45)',
        xs: '0 1px 2px rgba(10,12,13,.04)',
        card: '0 1px 1px rgba(10,12,13,.03), 0 2px 4px -2px rgba(10,12,13,.04), 0 0 0 1px rgba(10,12,13,.03)',
        'card-hover': '0 4px 8px -2px rgba(10,12,13,.06), 0 16px 32px -12px rgba(10,12,13,.14), 0 0 0 1px rgba(10,12,13,.04)',
        button: '0 1px 2px rgba(10,12,13,.08), 0 1px 1px rgba(10,12,13,.04), inset 0 1px 0 rgba(255,255,255,.08)',
        nav: '0 1px 0 rgba(10,12,13,.06)',
      },
      backgroundImage: {
        'grid-fade':
          'radial-gradient(55% 45% at 50% 0%, rgba(32,197,92,.10), transparent 70%)',
        'blob-a': 'radial-gradient(circle at 30% 30%, rgba(32,197,92,.35), transparent 65%)',
        'blob-b': 'radial-gradient(circle at 70% 70%, rgba(0,198,91,.25), transparent 65%)',
      },
      keyframes: {
        drift: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(2%, -3%) scale(1.05)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        drift: 'drift 14s ease-in-out infinite',
        'drift-slow': 'drift 20s ease-in-out infinite reverse',
      },
    },
  },
  plugins: [],
}
