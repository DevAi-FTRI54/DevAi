/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'tt-hoves': ['TT Hoves Pro', 'sans-serif'],
      },
      colors: {
        'custom-blue': '#3058EB',
        'custom-purple': '#3A3AFA',
        'brand-purple': '#a084f3',
        'brand-orange': '#ff9f43',
      },
    },
  },
  plugins: [],
};
