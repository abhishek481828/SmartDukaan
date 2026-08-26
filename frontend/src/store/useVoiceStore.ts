import { create } from "zustand";

const SESSION_STORAGE_KEY = "bv_voice_session";

export interface ChatAction {
  kind: string;
  status: string;
  requires_confirmation?: boolean;
  summary?: string;
  payload?: Record<string, unknown>;
  inventory?: Array<Record<string, unknown>>;
  transactions?: Array<Record<string, unknown>>;
}

export interface VoiceResponse {
  text: string;
  why?: string;
  what?: string;
  rupeesImpact?: number;
  action?: ChatAction;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  why?: string;
  what?: string;
  rupeesImpact?: number;
  action?: ChatAction;
  timestamp: number;
}

type PersistedVoiceState = {
  messages: ChatMessage[];
  sessionId: string | null;
};

interface VoiceState {
  isListening: boolean;
  isProcessing: boolean;
  error: string | null;
  transcript: string;
  response: VoiceResponse | null;
  messages: ChatMessage[];
  sessionId: string | null;
  setListening: (v: boolean) => void;
  setTranscript: (text: string) => void;
  setProcessing: (v: boolean) => void;
  setResponse: (r: VoiceResponse | null) => void;
  setError: (e: string | null) => void;
  setSessionId: (id: string) => void;
  hydratePersistedSession: () => void;
  addUserMessage: (text: string) => string;
  addAssistantMessage: (msg: Omit<ChatMessage, "role" | "timestamp">) => void;
  updateAssistantMessage: (id: string, patch: Partial<ChatMessage>) => void;
  clearSession: () => void;
  reset: () => void;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function persistSession(data: PersistedVoiceState) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
}

function readPersistedSession(): PersistedVoiceState {
  if (typeof window === "undefined") {
    return { messages: [], sessionId: null };
  }

  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return { messages: [], sessionId: null };
    const parsed = JSON.parse(raw) as PersistedVoiceState;
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      sessionId: parsed.sessionId ?? null,
    };
  } catch {
    return { messages: [], sessionId: null };
  }
}

const initialPersistedState = readPersistedSession();

export const useVoiceStore = create<VoiceState>((set) => ({
  isListening: false,
  isProcessing: false,
  error: null,
  transcript: "",
  response: null,
  messages: initialPersistedState.messages,
  sessionId: initialPersistedState.sessionId,

  setListening: (v) => set({ isListening: v }),
  setTranscript: (text) => set({ transcript: text }),
  setProcessing: (v) => set({ isProcessing: v }),
  setResponse: (r) => set({ response: r, isProcessing: false }),
  setError: (e) => set({ error: e, isProcessing: false, isListening: false }),
  setSessionId: (id) =>
    set((state) => {
      persistSession({ messages: state.messages, sessionId: id });
      return { sessionId: id };
    }),

  hydratePersistedSession: () => {
    const persisted = readPersistedSession();
    set({ messages: persisted.messages, sessionId: persisted.sessionId });
  },

  addUserMessage: (text) => {
    const id = uid();
    set((s) => {
      const nextMessage: ChatMessage = { id, role: "user", text, timestamp: Date.now() };
      const messages: ChatMessage[] = [...s.messages, nextMessage];
      persistSession({ messages, sessionId: s.sessionId });
      return { messages };
    });
    return id;
  },

  addAssistantMessage: (msg) => {
    set((s) => {
      const nextMessage: ChatMessage = {
        id: msg.id || uid(),
        role: "assistant",
        text: msg.text,
        why: msg.why,
        what: msg.what,
        rupeesImpact: msg.rupeesImpact,
        action: msg.action,
        timestamp: Date.now(),
      };
      const messages: ChatMessage[] = [...s.messages, nextMessage];
      persistSession({ messages, sessionId: s.sessionId });
      return { messages, isProcessing: false };
    });
  },

  updateAssistantMessage: (id, patch) => {
    set((s) => {
      const messages: ChatMessage[] = s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
      persistSession({ messages, sessionId: s.sessionId });
      return { messages };
    });
  },

  clearSession: () =>
    set(() => {
      persistSession({ messages: [], sessionId: null });
      return { messages: [], sessionId: null, transcript: "", response: null, error: null };
    }),

  reset: () => set({ isListening: false, isProcessing: false, transcript: "", response: null, error: null }),
}));
