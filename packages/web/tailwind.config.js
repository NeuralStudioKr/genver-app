/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sidebar: '#1a1a2e',
        'sidebar-hover': '#252542',
        'sidebar-active': '#2d2d4a',
        accent: '#3b82f6',
        'accent-hover': '#2563eb',
        'bot-bg': 'rgba(219, 234, 254, 0.3)',
      },
    },
  },
  plugins: [],
};
