import type { Metadata } from 'next';
import './globals.css';
import ErrorBoundary from '@/components/ErrorBoundary';
import ToastContainer from '@/components/Toast';

export const metadata: Metadata = {
  title: 'Helm - AI Operating System for Solo Founders',
  description: 'Your AI team of 21 specialists, orchestrated to run your business.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased">
        <ErrorBoundary>
          {children}
          <ToastContainer />
        </ErrorBoundary>
      </body>
    </html>
  );
}
