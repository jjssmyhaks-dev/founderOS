"use client";
import { Loader2 } from 'lucide-react';

interface Props {
  message?: string;
}

export default function LoadingSpinner({ message = 'Loading...' }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
      <p className="text-sm text-[var(--text-muted)]">{message}</p>
    </div>
  );
}
