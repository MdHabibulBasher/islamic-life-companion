/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep Green + Off White + Gold Premium Islamic Luxury theme
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Custom deep green palette
        'primary-green': {
          50: '#f0fdf9',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#0F7A3D',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        // Dark green for deeper tones
        'dark-green': {
          50: '#f0fdf9',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#15803d',
          700: '#166534',
          800: '#14532d',
          900: '#084D27',
        },
        // Off white palette
        'off-white': {
          50: '#ffffff',
          100: '#F8F9F5',
          200: '#f1f5f2',
          300: '#e2e8e0',
          400: '#cbd5e1',
          500: '#94a3b8',
          600: '#64748b',
          700: '#475569',
          800: '#334155',
          900: '#1e293b',
        },
        // Gold accent palette
        gold: {
          50: '#fffdf0',
          100: '#fefce8',
          200: '#fef3c7',
          300: '#fde68a',
          400: '#fcd34d',
          500: '#D4AF37',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Soft grey for neutral tones
        grey: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        // Keep some colors for compatibility
        emerald: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        coral: {
          50: '#fdf6f4',
          100: '#f9ebe6',
          200: '#f2d5cb',
          300: '#e8b8a8',
          400: '#db9480',
          500: '#c9745e',
        },
        slate: {
          950: '#030712',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      backgroundImage: {
        'gradient-primary-green': 'linear-gradient(135deg, #0F7A3D 0%, #059669 100%)',
        'gradient-dark-green': 'linear-gradient(135deg, #084D27 0%, #166534 100%)',
        'gradient-off-white': 'linear-gradient(135deg, #F8F9F5 0%, #f1f5f2 100%)',
        'gradient-gold': 'linear-gradient(135deg, #D4AF37 0%, #d97706 100%)',
        'gradient-luxury': 'linear-gradient(135deg, #0F7A3D 0%, #D4AF37 100%)',
        'gradient-premium': 'linear-gradient(135deg, #F8F9F5 0%, #e5e7eb 50%, #0F7A3D 100%)',
        'gradient-islamic': 'linear-gradient(135deg, #084D27 0%, #D4AF37 100%)',
        // Keep some original gradients for compatibility
        'gradient-emerald': 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        'gradient-purple': 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
        'gradient-violet': 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
        'gradient-teal': 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
        'gradient-magic': 'linear-gradient(135deg, #a855f7 0%, #14b8a6 100%)',
        'gradient-sage': 'linear-gradient(135deg, #f4f7f4 0%, #e8f0e8 100%)',
        'gradient-mint': 'linear-gradient(135deg, #f0f9f4 0%, #dcf5e4 100%)',
        'gradient-coral': 'linear-gradient(135deg, #fdf6f4 0%, #f9ebe6 100%)',
      },
      boxShadow: {
        'soft': '0 4px 20px rgba(0, 0, 0, 0.05)',
        'soft-lg': '0 10px 40px rgba(0, 0, 0, 0.08)',
        'glow-green': '0 0 20px rgba(15, 122, 61, 0.3)',
        'glow-gold': '0 0 20px rgba(212, 175, 55, 0.3)',
        'glow-luxury': '0 0 20px rgba(15, 122, 61, 0.2), 0 0 40px rgba(212, 175, 55, 0.2)',
        'shadow-premium': '0 4px 20px rgba(212, 175, 55, 0.1)',
      }
    },
  },
  plugins: [],
}
