/**
 * 6D consumer self-care template (demo-app-test Service Center look):
 * crimson → purple gradient chrome, Montserrat, rounded white cards on a
 * decorated background. `royal` = link/selection blue, `navy` = title ink,
 * `crimson`/`plum` = brand gradient stops used for primary actions.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1B2140',
        ink: { 900: '#1B2140', 700: '#3F4458', 600: '#5F6475', 400: '#9A9EAB' },
        royal: { DEFAULT: '#1F5FC4', 50: '#EEF4FD', 100: '#D9E6FA', 600: '#1F5FC4', 700: '#0B4EA2' },
        crimson: { DEFAULT: '#E31E43', 50: '#FDECEF', 600: '#C9183A' },
        plum: { DEFAULT: '#5C4374', 700: '#3B2A59' },
        brandorange: { DEFAULT: '#FF8A00', 50: '#FFF3E3', 600: '#E67A00' },
        sunny: '#FFD400',
        mint: '#B4E2CE',
        teal: { DEFAULT: '#00B4D8', 50: '#E5F7FB' },
        surface: { 50: '#F7F8FA', 100: '#EEF0F3' },
        line: { 100: '#ECECEF', 200: '#DADCE2' },
      },
      backgroundImage: {
        brand: 'linear-gradient(90deg, #E31E43 0%, #C8264A 55%, #5C4374 100%)',
        'brand-soft': 'linear-gradient(90deg, rgba(255,255,255,.96) 0%, rgba(253,236,239,.9) 100%)',
        aarya: 'linear-gradient(90deg, #1B2A6B 0%, #5B1E8A 100%)',
      },
      fontFamily: { sans: ['Montserrat', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'] },
      borderRadius: { card: '20px' },
    },
  },
  plugins: [],
};
