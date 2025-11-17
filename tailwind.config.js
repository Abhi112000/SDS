module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./app/**/*.{js,jsx}"],
  theme: { extend: {
    colors: {
      primary: '#B71C1C',
      secondary: '#1976D2',
      'accent-red-tint': '#F9E4E4',
      'accent-blue-tint': '#E7F3FF'
    },
    boxShadow: {
      'focus-ring': '0 0 0 4px rgba(25,118,210,0.12)',
      'focus-ring-primary': '0 0 0 4px rgba(183,28,28,0.18)'
    },
    container: { center: true, padding: '1rem' }
  } },
  plugins: []
}
