"use client";

import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Mic, MicOff, Paperclip } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';

export default function ChatInput() {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage, isLoading, isRecording, setRecording } = useChatStore();

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    sendMessage(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setRecording(false);
    } else {
      setRecording(true);
      // In production: start MediaRecorder, send audio to /chat/voice
      // Auto-stop after 60s
      setTimeout(() => setRecording(false), 60000);
    }
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] p-4">
      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        <button
          className="p-2.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
          title="Attach file (coming soon)"
          disabled
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Ask Helm anything..."
            rows={1}
            className="w-full resize-none rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors pr-12"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!value.trim() || isLoading}
            className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={toggleRecording}
          className={`p-2.5 rounded-lg transition-colors shrink-0 ${isRecording
            ? 'bg-red-500/10 text-red-400 animate-pulse'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
          }`}
          title={isRecording ? 'Stop recording' : 'Voice input'}
        >
          {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
      </div>
      <p className="text-center text-[10px] text-[var(--text-muted)] mt-2">
        {isRecording ? '🔴 Recording... Click mic to stop' : 'Press Enter to send, Shift+Enter for new line'}
      </p>
    </div>
  );
}
