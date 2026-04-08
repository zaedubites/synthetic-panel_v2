/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@eduBITES/edubites-design-system/dist/**/*.{js,mjs}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--brand-primary)',
        secondary: 'var(--brand-secondary)',
        tertiary: 'var(--brand-tertiary)',
      },
    },
  },
  plugins: [],
}
