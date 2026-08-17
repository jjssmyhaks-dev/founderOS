"use client";

import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string; type: ToastType; message: string;
}

let addToastFn: ((type: ToastType, message: string) => void) | null = null;
export function toast(type: ToastType, message: string) {
  addToastFn?.(type, message);
}

const icons = {
  success: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
};
const bg = { success: 'border-emerald-500/30', error: 'border-red-500/30', info: 'border-blue-500/30' };

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    addToastFn = (type: ToastType, message: string) => {
      const id = String(Date.now());
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    };
    return () => { addToastFn = null; };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg border bg-gray-900/95 backdrop-blur shadow-lg ${bg[t.type]} animate-slideIn`}>
          {icons[t.type]}
          <span className="text-sm text-gray-200 flex-1">{t.message}</span>
          <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} className="text-gray-500 hover:text-gray-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
