import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx,md}'],
  theme: {
    extend: {
      colors: {
        canvas: '#050510',
        panel: '#101722',
        panelAlt: '#0f1620',
        accent: '#4f8cff',
        accentSoft: '#7aa7ff',
        ink: '#f4f7fb',
        mute: '#9ca7b6',
        success: '#49b47f',
        warning: '#f4a261',
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--muted-foreground) / <alpha-value>)'
      },
      boxShadow: {
        panel: '0 10px 40px rgba(0,0,0,0.25)',
        card: '0 4px 16px rgba(0,0,0,0.24)',
        inner: 'inset 0 2px 4px rgba(0,0,0,0.05)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: [typography]
};
