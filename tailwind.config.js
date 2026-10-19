/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // "Blæk og rettepen" – se src/index.css for brug
        paper: '#F4F5F7',      // sidebaggrund
        surface: '#FFFFFF',    // flader
        ink: {
          DEFAULT: '#1E2B3A',  // tekst og primære handlinger
          soft: '#5D6875',     // sekundær tekst
          faint: '#8A939D'     // hjælpetekst
        },
        line: {
          DEFAULT: '#DDE1E6',
          strong: '#C5CBD2'
        },
        pen: {
          DEFAULT: '#B4372B',  // rettepen: kræver opmærksomhed / slet
          soft: '#FBEDEB'
        },
        ok: {
          DEFAULT: '#2E6B4E',  // godkendt af læreren
          soft: '#E8F2EC'
        },
        focus: '#3B6FB6'
      },
      fontFamily: {
        sans: ['"Public Sans Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
      },
      borderRadius: {
        surface: '10px',
        control: '7px'
      }
    }
  },
  plugins: []
};
