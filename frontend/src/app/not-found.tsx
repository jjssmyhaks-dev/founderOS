"use client";

import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-6">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center">
            <Zap className="w-7 h-7 text-white" />
          </div>
        </div>
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <h2 className="text-xl text-[var(--text-secondary)] mb-8">Page not found</h2>
        <p className="text-[var(--text-muted)] mb-8 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] hover:opacity-90 text-white font-medium rounded-lg text-sm transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
