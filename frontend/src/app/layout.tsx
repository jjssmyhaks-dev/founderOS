import type { Metadata, Viewport } from 'next';
import './globals.css';
import ErrorBoundary from '@/components/ErrorBoundary';
import ToastContainer from '@/components/Toast';

export const metadata: Metadata = {
  title: {
    default: 'Helm — AI Operating System for Solo Founders',
    template: '%s | Helm',
  },
  description: 'Helm puts research, marketing, operations, and finance on autopilot — 21 specialist AI agents working from one chat, so a team of one can operate like a team of twenty.',
  keywords: ['AI', 'artificial intelligence', 'solo founders', 'startup', 'automation', 'business operations', 'marketing', 'finance', 'research'],
  authors: [{ name: 'DoZero.ai' }],
  creator: 'DoZero.ai',
  publisher: 'DoZero.ai',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://helm.dozero.ai'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'Helm AI OS',
    title: 'Helm — AI Operating System for Solo Founders',
    description: '21 specialist AI agents working from one chat, so a team of one can operate like a team of twenty.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Helm AI Operating System',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Helm — AI Operating System for Solo Founders',
    description: '21 specialist AI agents working from one chat, so a team of one can operate like a team of twenty.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased">
        <ErrorBoundary>
          {children}
          <ToastContainer />
        </ErrorBoundary>
      </body>
    </html>
  );
}
