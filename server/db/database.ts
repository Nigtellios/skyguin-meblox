import { Database } from "bun:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "../../database.sqlite");

export function configureDatabase(database: Database) {
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
}

export function initializeDatabase(database: Database) {
  database.exec(`
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
      material_type TEXT DEFAULT 'wood',
      object_shape TEXT DEFAULT 'box',
      edge_banding_json TEXT DEFAULT NULL,
      edge_rounding_json TEXT DEFAULT NULL,
      material_template_id TEXT,
      component_id TEXT,
      is_independent INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (material_template_id) REFERENCES material_templates(id) ON DELETE SET NULL,
      FOREIGN KEY (component_id) REFERENCES component_groups(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS object_relations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_object_id TEXT NOT NULL,
      target_object_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      source_field TEXT NOT NULL,
      target_field TEXT NOT NULL,
      mode TEXT NOT NULL,
      source_anchor TEXT,
      target_anchor TEXT,
      offset_mm REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (source_object_id) REFERENCES furniture_objects(id) ON DELETE CASCADE,
      FOREIGN KEY (target_object_id) REFERENCES furniture_objects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_history (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      action_label TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  // Migration: add thumbnail column if it doesn't exist yet
  const hasThumbnail = database
    .query(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('projects') WHERE name = 'thumbnail'",
    )
    .get() as { cnt: number };
  if (!hasThumbnail || hasThumbnail.cnt === 0) {
    database.exec(
      "ALTER TABLE projects ADD COLUMN thumbnail TEXT DEFAULT NULL",
    );
  }

  // Migration: add material_type column if it doesn't exist yet
  const hasMaterialType = database
    .query(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('furniture_objects') WHERE name = 'material_type'",
    )
    .get() as { cnt: number };
  if (!hasMaterialType || hasMaterialType.cnt === 0) {
    database.exec(
      "ALTER TABLE furniture_objects ADD COLUMN material_type TEXT DEFAULT 'wood'",
    );
  }

  // Migration: add edge_banding_json column if it doesn't exist yet
  const hasEdgeBanding = database
    .query(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('furniture_objects') WHERE name = 'edge_banding_json'",
    )
    .get() as { cnt: number };
  if (!hasEdgeBanding || hasEdgeBanding.cnt === 0) {
    database.exec(
      "ALTER TABLE furniture_objects ADD COLUMN edge_banding_json TEXT DEFAULT NULL",
    );
  }

  // Migration: add object_shape column if it doesn't exist yet
  const hasObjectShape = database
    .query(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('furniture_objects') WHERE name = 'object_shape'",
    )
    .get() as { cnt: number };
  if (!hasObjectShape || hasObjectShape.cnt === 0) {
    database.exec(
      "ALTER TABLE furniture_objects ADD COLUMN object_shape TEXT DEFAULT 'box'",
    );
  }

  // Migration: add edge_rounding_json column if it doesn't exist yet
  const hasEdgeRounding = database
    .query(
      "SELECT COUNT(*) as cnt FROM pragma_table_info('furniture_objects') WHERE name = 'edge_rounding_json'",
    )
    .get() as { cnt: number };
  if (!hasEdgeRounding || hasEdgeRounding.cnt === 0) {
    database.exec(
      "ALTER TABLE furniture_objects ADD COLUMN edge_rounding_json TEXT DEFAULT NULL",
    );
  }

  const existingProject = database
    .query("SELECT id FROM projects LIMIT 1")
    .get();
  if (!existingProject) {
    const now = Date.now();
    const defaultProjectId = crypto.randomUUID();
    database
      .query(
        `INSERT INTO projects (id, name, description, grid_size_mm, grid_visible, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(defaultProjectId, "Projekt 1", "Domyślny projekt", 100, 1, now, now);
  }
}

export function createDatabase(dbPath: string) {
  const database = new Database(dbPath, { create: true });
  configureDatabase(database);
  initializeDatabase(database);
  return database;
}

let databaseInstance: Database | null = null;

export function getDatabase() {
  if (!databaseInstance) {
    databaseInstance = new Database(DB_PATH, { create: true });
    configureDatabase(databaseInstance);
    initializeDatabase(databaseInstance);
  }

  return databaseInstance;
}
