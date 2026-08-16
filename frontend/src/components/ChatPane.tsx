"use client";

import { useRef, useEffect } from 'react';
import MessageList from './chat/MessageList';
import ChatInput from './chat/ChatInput';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import { Compass } from 'lucide-react';

export default function ChatPane() {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const isOnboarding = useChatStore((s) => s.isOnboarding);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {isOnboarding && messages.length === 0 && (
        <div className="px-4 py-3 bg-[var(--accent)]/5 border-b border-[var(--accent)]/10">
          <div className="flex items-center gap-2 mb-1">
            <Compass className="w-4 h-4 text-[var(--accent)]" />
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Welcome{user?.name ? `, ${user.name}` : ''}{user?.businessName ? ` — ${user.businessName}` : ''}
            </p>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Tell Helm about your business and it&apos;ll start working for you right away.
          </p>
        </div>
      )}
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput />
      <div ref={bottomRef} />
    </div>
  );
}