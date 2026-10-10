/** @type {import('tailwindcss').Config} */
import animate from "tailwindcss-animate";

export default {
    darkMode: ["class"],
    content: ["./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
                wordmark: ['"Great Vibes"', 'cursive'],
                jp: ['Noto Sans JP', 'ui-sans-serif', 'system-ui', 'sans-serif']
            },
            colors: {
                sage: {
                    '50': '#FBF6EC',
                    '100': '#F3E8CC',
                    '200': '#E6D2A0',
                    '300': '#E4C98A',
                    '400': '#C6A45A',
                    '500': '#A8873E',
                    '600': '#6B5424',
                    '700': '#5C481C',
                    '800': '#3E3216',
                    '900': '#2A2210',
                    '950': '#161208'
                },
                amethyst: {
                    '50': '#f7f7fa',
                    '100': '#ebebf5',
                    '200': '#dcdcf0',
                    '300': '#c4c4e6',
                    '400': '#a3a3d6',
                    '500': '#8282c4',
                    '600': '#6969a8',
                    '700': '#55558a',
                    '800': '#44446e',
                    '900': '#383857',
                    '950': '#232336'
                },
                harbor: {
                    '50': '#f5f7f8',
                    '100': '#e7edf0',
                    '200': '#cfdae0',
                    '300': '#adbec8',
                    '400': '#849daa',
                    '500': '#687f8c',
                    '600': '#536874',
                    '700': '#465760',
                    '800': '#3b484f',
                    '900': '#333d42',
                    '950': '#1b2226'
                },
                ember: {
                    '50': '#f8f6f1',
                    '100': '#eee8dc',
                    '200': '#ded1ba',
                    '300': '#c7b18d',
                    '400': '#a98d64',
                    '500': '#8c704d',
                    '600': '#70583e',
                    '700': '#5b4937',
                    '800': '#4b3d31',
                    '900': '#40352c',
                    '950': '#241d18'
                },
                slate: {
                    '800': '#292524',
                    '850': '#231f1c',
                    '900': '#1c1917',
                    '950': '#0c0a09'
                },
                zinc: {
                    '900': '#1c1917',
                    '950': '#0c0a09'
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
            transitionTimingFunction: {
                spring: 'cubic-bezier(0.16, 1, 0.3, 1)'
            },
            animation: {
                'spring-enter': 'enter 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                'shimmer': 'shimmer 2s linear infinite'
            },
            keyframes: {
                shimmer: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' }
                }
            }
        },
    },
    plugins: [animate],
}
