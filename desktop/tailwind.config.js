/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gh: {
          canvas: '#0d1117',
          inset: '#010409',
          surface: '#161b22',
          subtle: '#21262d',
          border: '#30363d',
          'border-subtle': '#21262d',
          text: '#c9d1d9',
          'text-bright': '#f0f6fc',
          'text-muted': '#8b949e',
          'text-dim': '#484f58',
          green: '#238636',
          'green-hover': '#2ea043',
          'green-text': '#3fb950',
          'green-bg': 'rgba(46, 160, 67, 0.15)',
          red: '#da3633',
          'red-text': '#f85149',
          purple: '#8957e5',
          'purple-text': '#a371f7',
          blue: '#1f6feb',
          'blue-text': '#58a6ff',
          'blue-border': '#388bfd',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Noto Sans"', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
