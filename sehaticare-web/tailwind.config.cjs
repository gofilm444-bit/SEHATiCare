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
          DEFAULT: '#176b87',
          light: '#dff5f8',
          dark: '#123b5c'
        },
        empathy: '#d96863',
        support: '#856fbe',
        progress: '#14846f'
      },
      borderRadius: {
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
