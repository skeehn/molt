// Session store - simple JSON file (fast, no native deps, no WASM)
import { join } from 'path';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import type { Message } from '../providers/types.js';

const DB_DIR = join(homedir(), '.grain');
const DB_PATH = join(DB_DIR, 'sessions.json');

interface SessionRecord {
  id: string;
  title: string | null;
  messages: Array<{ id: string; role: string; content_json: string; created_at: string }>;
  created_at: string;
  updated_at: string;
}

interface SessionStore {
  sessions: SessionRecord[];
}

let store: SessionStore | null = null;

function getStore(): SessionStore {
  if (store) return store;

  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  if (existsSync(DB_PATH)) {
    try {
      store = JSON.parse(readFileSync(DB_PATH, 'utf-8'));
      return store!;
    } catch {
      // Corrupted, start fresh
    }
  }

  store = { sessions: [] };
  return store;
}

function saveStore() {
  if (store) {
    // Keep only last 50 sessions to prevent bloat
    if (store.sessions.length > 50) {
      store.sessions = store.sessions.slice(-50);
    }
    writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
  }
}

export async function createSession(title?: string): Promise<string> {
  const id = randomUUID();
  const s = getStore();
  s.sessions.push({
    id,
    title: title || null,
    messages: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  saveStore();
  return id;
}

export async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: Message['content']
): Promise<void> {
  const s = getStore();
  const session = s.sessions.find(sess => sess.id === sessionId);
  if (!session) return;

  session.messages.push({
    id: randomUUID(),
    role,
    content_json: JSON.stringify(content),
    created_at: new Date().toISOString(),
  });
  session.updated_at = new Date().toISOString();

  // Keep only last 100 messages per session
  if (session.messages.length > 100) {
    session.messages = session.messages.slice(-100);
  }

  saveStore();
}

export async function getMessages(sessionId: string): Promise<Message[]> {
  const s = getStore();
  const session = s.sessions.find(sess => sess.id === sessionId);
  if (!session) return [];

  return session.messages.map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: JSON.parse(msg.content_json),
  }));
}

export async function getLastSession(): Promise<string | null> {
  const s = getStore();
  if (s.sessions.length === 0) return null;
  // Sort by updated_at descending
  const sorted = [...s.sessions].sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  return sorted[0].id;
}
