import { useAuthStore } from '@/stores/auth.store';
import { useChatStore } from '@/stores/chat.store';
import { useApprovalStore } from '@/stores/approvals.store';
import { useConnectorStore } from '@/stores/connectors.store';
import { useActivityStore } from '@/stores/activity.store';

export function useAuth() { return useAuthStore(); }
export function useChat() { return useChatStore(); }
export function useApprovals() { return useApprovalStore(); }
export function useConnectors() { return useConnectorStore(); }
export function useActivity() { return useActivityStore(); }
