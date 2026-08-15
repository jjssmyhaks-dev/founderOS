"use client";

import ReactMarkdown from 'react-markdown';
import { getLayerConfig } from '@/config/agents';
import type { ChatMsg } from '@/stores/chat.store';

interface Props { messages: ChatMsg[]; isLoading: boolean; }

export default function MessageList({ messages, isLoading }: Props) {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-4">
          <div className="text-5xl mb-4">⭐</div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Welcome to Helm</h2>
          <p className="text-sm text-[var(--text-secondary)] max-w-md">
            Your AI operating system. Ask me anything — research, marketing, operations, finance.
            I&apos;ll route to the right agent automatically.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['How\'s cash flow this week?', 'Research my top 3 competitors', 'Draft a marketing email for our launch', 'What tasks need my approval?'].map((q) => (
              <button
                key={q}
                onClick={() => {
                  const input = document.querySelector('textarea[placeholder*="Ask"]') as HTMLTextAreaElement;
                  if (input) { input.value = q; input.dispatchEvent(new Event('input', { bubbles: true })); }
                }}
                className="px-3 py-1.5 text-xs rounded-full border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === 'FOUNDER' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[80%] ${msg.role === 'FOUNDER'
            ? 'bg-[var(--accent)]/10 rounded-2xl rounded-br-md px-4 py-2.5'
            : msg.role === 'SYSTEM'
              ? 'mx-auto text-center text-xs text-[var(--text-muted)] py-1'
              : 'rounded-2xl rounded-bl-md bg-[var(--bg-secondary)] border border-[var(--border)] px-4 py-2.5'
          }`}>
            {msg.role !== 'SYSTEM' && msg.role !== 'FOUNDER' && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-xs">⭐</span>
                <span className="text-xs font-medium text-[var(--text-secondary)]">Helm</span>
                {msg.layer && (
                  <>
                    <span className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: getLayerConfig(msg.layer).color }} />
                    <span className="text-xs" style={{ color: getLayerConfig(msg.layer).color }}>
                      {getLayerConfig(msg.layer).name}
                    </span>
                  </>
                )}
              </div>
            )}
            <div className={`text-sm leading-relaxed ${msg.role === 'FOUNDER' ? '' : 'prose prose-invert prose-sm max-w-none'}`}>
              {msg.role === 'AGENT' ? (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-3">
            <div className="flex gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
