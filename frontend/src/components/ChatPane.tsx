"use client";

import { useRef, useEffect } from 'react';
import { useChatStore, ChatMsg } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from './Toast';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';

export default function ChatPane() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages, isLoading, isOnboarding, sendMessage } = useChatStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    const input = inputRef.current;
    if (!input?.value.trim() || isLoading) return;
    const content = input.value.trim();
    input.value = '';
    try {
      await sendMessage(content);
    } catch (err: any) {
      toast('error', err.message || 'Failed to send message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Onboarding banner */}
      {isOnboarding && messages.length === 0 && (
        <div className="mx-4 mt-4 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">Getting started</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Welcome{user?.name ? `, ${user.name}` : ''}! I&apos;m Helm, your AI operating system. Let me learn about your business so I can help you effectively.
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isOnboarding && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-60">
            <Bot className="w-10 h-10 text-[var(--text-muted)]" />
            <p className="text-[var(--text-muted)] text-sm">What would you like to work on?</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'FOUNDER' ? 'justify-end' : ''}`}>
            {msg.role !== 'FOUNDER' && (
              <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-[var(--accent)]" />
              </div>
            )}
            <div className={`max-w-[75%] ${msg.role === 'FOUNDER' ? 'items-end' : 'items-start'}`}>
              <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === 'FOUNDER'
                  ? 'bg-[var(--accent)] text-white rounded-br-md'
                  : 'bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] rounded-bl-md'
              }`}>
                {msg._error ? (
                  <span className="text-red-400">Failed to send. Try again.</span>
                ) : (
                  msg.content
                )}
              </div>
              {msg.agentId && msg.role !== 'FOUNDER' && (
                <span className="text-[10px] text-[var(--text-muted)] mt-1 ml-1">{msg.agentId.split('.').pop()}</span>
              )}
            </div>
            {msg.role === 'FOUNDER' && (
              <div className="w-7 h-7 rounded-lg bg-gray-700 flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4 text-gray-300" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex gap-2 items-end bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl px-4 py-2">
          <input
            ref={inputRef}
            type="text"
            placeholder={isOnboarding ? 'Tell Helm about your business...' : 'Ask Helm anything...'}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none py-1"
            disabled={isLoading}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="p-2 rounded-lg bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 text-white transition-opacity"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
