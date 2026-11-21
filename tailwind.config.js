/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surface)', surface2: 'var(--surface2)',
        line: 'var(--line)', ink: 'var(--ink)', muted: 'var(--muted)',
        accent: { DEFAULT: 'var(--accent)', hover: 'var(--accent-hover)', soft: 'var(--accent-soft)' },
        gold: 'var(--marigold)', mint: 'var(--pistachio)', rose: 'var(--coral)', sky: 'var(--sky)',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"DM Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 10px rgba(0, 0, 0, .20), 0 18px 32px -18px rgba(0, 0, 0, .55)',
        pop: '0 22px 54px -20px rgba(0, 0, 0, .72)',
        glow: '0 2px 14px rgba(168, 197, 154, .13)',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        slidein: { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
      animation: {
        rise: 'rise .32s cubic-bezier(.2,.7,.2,1) both',
        fade: 'fade .18s ease both',
        slidein: 'slidein .24s cubic-bezier(.2,.7,.2,1) both',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
