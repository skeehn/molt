import { Database } from 'bun:sqlite';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import type { Message } from '../providers/types.js';

const DB_DIR = join(homedir(), '.grain');
const DB_PATH = join(DB_DIR, 'sessions.db');

let db: Database | null = null;

function getDb(): Database {
  if (db) return db;

  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.run('PRAGMA journal_mode = WAL');

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)`);

  return db;
}

export function createSession(title?: string): string {
  const id = randomUUID();
  const database = getDb();
  database.prepare('INSERT INTO sessions (id, title) VALUES (?, ?)').run(id, title || 'Untitled');
  return id;
}

export function addMessage(sessionId: string, role: string, content: any[]): void {
  const database = getDb();
  const id = randomUUID();
  database.prepare('INSERT INTO messages (id, session_id, role, content_json) VALUES (?, ?, ?, ?)').run(
    id, sessionId, role, JSON.stringify(content)
  );
  database.prepare("UPDATE sessions SET updated_at = datetime('now') WHERE id = ?").run(sessionId);
}

export function getMessages(sessionId: string): Message[] {
  const database = getDb();
  const rows = database.prepare('SELECT role, content_json FROM messages WHERE session_id = ? ORDER BY created_at').all(sessionId) as any[];
  return rows.map(row => ({
    role: row.role as 'user' | 'assistant',
    content: JSON.parse(row.content_json),
  }));
}

export function listSessions(limit = 20): Array<{ id: string; title: string; created_at: string; updated_at: string }> {
  const database = getDb();
  return database.prepare('SELECT id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC LIMIT ?').all(limit) as any[];
}

export function getLastSession(): { id: string; title: string } | null {
  const database = getDb();
  const row = database.prepare('SELECT id, title FROM sessions ORDER BY updated_at DESC LIMIT 1').get() as any;
  return row || null;
}

export function updateSessionTitle(sessionId: string, title: string): void {
  const database = getDb();
  database.prepare('UPDATE sessions SET title = ? WHERE id = ?').run(title, sessionId);
}
