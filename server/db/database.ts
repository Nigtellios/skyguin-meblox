import { Database } from "bun:sqlite";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "../../database.sqlite");

export const db = new Database(DB_PATH, { create: true });

// Enable WAL mode for better performance
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      grid_size_mm REAL DEFAULT 100,
      grid_visible INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS component_groups (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS material_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      base_color TEXT DEFAULT '#8B7355',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS material_layers (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      side TEXT NOT NULL,
      layer_type TEXT NOT NULL DEFAULT 'veneer',
      color TEXT NOT NULL DEFAULT '#D4A574',
      thickness REAL DEFAULT 0.5,
      is_bilateral INTEGER DEFAULT 0,
      opposite_side TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (template_id) REFERENCES material_templates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS furniture_objects (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      width REAL NOT NULL DEFAULT 600,
      height REAL NOT NULL DEFAULT 720,
      depth REAL NOT NULL DEFAULT 18,
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 0,
      position_z REAL DEFAULT 0,
      rotation_y REAL DEFAULT 0,
      color TEXT DEFAULT '#8B7355',
      material_template_id TEXT,
      component_id TEXT,
      is_independent INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (material_template_id) REFERENCES material_templates(id) ON DELETE SET NULL,
      FOREIGN KEY (component_id) REFERENCES component_groups(id) ON DELETE SET NULL
    );
  `);

  // Seed a default project if none exists
  const existing = db.query("SELECT id FROM projects LIMIT 1").get();
  if (!existing) {
    const now = Date.now();
    const defaultProjectId = crypto.randomUUID();
    db.query(
      `INSERT INTO projects (id, name, description, grid_size_mm, grid_visible, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(defaultProjectId, "Projekt 1", "Domyślny projekt", 100, 1, now, now);
  }
}
