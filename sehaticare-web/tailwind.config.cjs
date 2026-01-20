/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: {
          DEFAULT: '#0f766e',
          light: '#14b8a6',
          dark: '#0d5c56'
        }
      },
      borderRadius: {
        lg: '0.75rem',
        xl: '1rem'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
