/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Couleurs du cockpit SOMONE - Mode CLAIR (conforme PDF)
        cockpit: {
          // Fond principal - gris très clair
          bg: {
            light: '#F5F7FA',
            card: '#FFFFFF',
            hover: '#EEF2F7',
          },
          // Header/Navbar - bleu marine foncé
          nav: {
            bg: '#1E3A5F',
            active: '#FFFFFF',
            activeText: '#1E3A5F',
            text: '#FFFFFF',
          },
          // Statuts des tuiles (couleurs PDF SOMONE exactes)
          status: {
            critique: '#E57373',    // Rouge rosé
            mineur: '#FFB74D',      // Orange/Ambre
            ok: '#9CCC65',          // Vert lime
            deconnecte: '#9E9E9E',  // Gris
          },
          // Textes
          text: {
            primary: '#1E3A5F',     // Bleu marine pour titres
            secondary: '#64748B',   // Gris pour texte secondaire
            muted: '#94A3B8',       // Gris clair
          },
          // Bordures
          border: {
            light: '#E2E8F0',
            medium: '#CBD5E1',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite',
        'marquee': 'marquee 30s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
    },
  },
  plugins: [],
}
