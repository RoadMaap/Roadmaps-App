/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: { 
        sans: ['Vazirmatn', 'sans-serif'],
        vazir: ['Vazirmatn', 'sans-serif'],
      },
      colors: {
        page: 'var(--bg-page)',
        panel: 'var(--bg-card)',
        border: 'var(--border-color)',
        primary: 'var(--primary)',
        danger: 'var(--error)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
      },
    },
  },
  plugins: [],
}