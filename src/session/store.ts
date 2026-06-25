import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { join } from 'path';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import type { Message } from '../providers/types.js';

const DB_DIR = join(homedir(), '.grain');
const DB_PATH = join(DB_DIR, 'sessions.db');

let db: SqlJsDatabase | null = null;
let SQL: any = null;

async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  // Load existing database or create new
  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
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

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
  }
}

export async function createSession(title?: string): Promise<string> {
  const id = randomUUID();
  const database = await getDb();
  
  database.run(
    'INSERT INTO sessions (id, title) VALUES (?, ?)',
    [id, title || null]
  );
  
  saveDb();
  return id;
}

export async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: Message['content']
): Promise<void> {
  const id = randomUUID();
  const database = await getDb();
  
  database.run(
    'INSERT INTO messages (id, session_id, role, content_json) VALUES (?, ?, ?, ?)',
    [id, sessionId, role, JSON.stringify(content)]
  );
  
  database.run(
    'UPDATE sessions SET updated_at = datetime("now") WHERE id = ?',
    [sessionId]
  );
  
  saveDb();
}

export async function getMessages(sessionId: string): Promise<Message[]> {
  const database = await getDb();
  
  const stmt = database.prepare(
    'SELECT role, content_json FROM messages WHERE session_id = ? ORDER BY created_at ASC'
  );
  
  const rows: Message[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    rows.push({
      role: row.role as 'user' | 'assistant',
      content: JSON.parse(row.content_json as string),
    });
  }
  
  stmt.free();
  return rows;
}

export async function getLastSession(): Promise<string | null> {
  const database = await getDb();
  
  const stmt = database.prepare(
    'SELECT id FROM sessions ORDER BY updated_at DESC LIMIT 1'
  );
  
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row.id as string;
  }
  
  stmt.free();
  return null;
}
