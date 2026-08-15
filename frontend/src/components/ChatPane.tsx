"use client";

import { useRef, useEffect } from 'react';
import MessageList from './chat/MessageList';
import ChatInput from './chat/ChatInput';
import { useChatStore } from '@/stores/chat.store';

export default function ChatPane() {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput />
      <div ref={bottomRef} />
    </div>
  );
}
