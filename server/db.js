import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.sqlite')

// En Azure App Service (Linux), el código bajo /home/site/wwwroot se
// reemplaza en cada despliegue: si DB_PATH apunta ahí, la base se perdería
// con cada deploy. Debe apuntar a una carpeta persistida (p.ej. /home/data),
// que puede no existir todavía en el primer arranque.
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

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

CREATE TABLE IF NOT EXISTS observaciones (
  id TEXT PRIMARY KEY,
  viaje_id TEXT NOT NULL REFERENCES viajes(id),
  trayecto_id TEXT REFERENCES trayectos(id),
  autor TEXT,
  texto TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT -1
);

CREATE INDEX IF NOT EXISTS idx_viajes_user ON viajes(user_id);
CREATE INDEX IF NOT EXISTS idx_trayectos_viaje ON trayectos(viaje_id);
CREATE INDEX IF NOT EXISTS idx_observaciones_viaje ON observaciones(viaje_id);
CREATE INDEX IF NOT EXISTS idx_observaciones_trayecto ON observaciones(trayecto_id);
`)

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

ensureColumn('viajes', 'codigo', 'TEXT')
ensureColumn('trayectos', 'codigo', 'TEXT')
ensureColumn('trayectos', 'estado', "TEXT NOT NULL DEFAULT 'abierto'")
ensureColumn('trayectos', 'closed_at', 'TEXT')
ensureColumn('trayectos', 'closed_by', 'INTEGER REFERENCES users(id)')

// Asigna el código legible secuencial (V-0001) a viajes creados antes de que
// existiera esta columna, y a los trayectos ya existentes (ligado al del
// viaje: V-0001-T2). Solo corre sobre lo que aún no tiene código.
const viajesSinCodigo = db.prepare('SELECT id FROM viajes WHERE codigo IS NULL ORDER BY created_at ASC').all()
if (viajesSinCodigo.length) {
  db.prepare(`INSERT INTO counters (name, value) VALUES ('viaje', -1) ON CONFLICT(name) DO NOTHING`).run()
  const incrementar = db.prepare(`UPDATE counters SET value = value + 1 WHERE name = 'viaje' RETURNING value`)
  const asignar = db.prepare('UPDATE viajes SET codigo = ? WHERE id = ?')
  for (const { id } of viajesSinCodigo) {
    const { value } = incrementar.get()
    asignar.run(`V-${String(value).padStart(4, '0')}`, id)
  }
}

const trayectosSinCodigo = db
  .prepare(
    `SELECT t.id, t.numero, v.codigo AS viaje_codigo FROM trayectos t
     JOIN viajes v ON v.id = t.viaje_id
     WHERE t.codigo IS NULL`,
  )
  .all()
for (const t of trayectosSinCodigo) {
  db.prepare('UPDATE trayectos SET codigo = ? WHERE id = ?').run(`${t.viaje_codigo}-T${t.numero}`, t.id)
}

// Siguiente código secuencial de viaje (V-0000, V-0001, ...). Atómico porque
// better-sqlite3 es síncrono: no hay forma de que dos requests se intercalen
// entre el UPDATE y la lectura del valor.
export function nextViajeCodigo() {
  db.prepare(`INSERT INTO counters (name, value) VALUES ('viaje', -1) ON CONFLICT(name) DO NOTHING`).run()
  const { value } = db.prepare(`UPDATE counters SET value = value + 1 WHERE name = 'viaje' RETURNING value`).get()
  return `V-${String(value).padStart(4, '0')}`
}
