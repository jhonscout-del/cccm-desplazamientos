import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.sqlite')

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  azure_oid TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viajero',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS viajes (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  estado TEXT NOT NULL DEFAULT 'abierto',
  nombre_reporta TEXT,
  fecha_viaje TEXT,
  fecha_reporte TEXT,
  jefe_inmediato TEXT,
  area TEXT,
  origen TEXT,
  destino TEXT,
  transporte_tipo TEXT,
  transporte_detalle TEXT,
  hora_inicio TEXT,
  contacto_nombre TEXT,
  correo_variable TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  closed_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS trayectos (
  id TEXT PRIMARY KEY,
  viaje_id TEXT NOT NULL REFERENCES viajes(id),
  numero INTEGER NOT NULL,
  fecha_reporte TEXT,
  jefe_inmediato TEXT,
  area TEXT,
  origen TEXT,
  destino TEXT,
  transporte TEXT,
  hora_salida TEXT,
  hora_llegada_estimada TEXT,
  contacto_emergencia TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_viajes_user ON viajes(user_id);
CREATE INDEX IF NOT EXISTS idx_trayectos_viaje ON trayectos(viaje_id);
`)
