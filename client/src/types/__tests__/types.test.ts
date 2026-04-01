import { describe, expect, test } from "bun:test";
import {
  ComponentGroupSchema,
  FurnitureObjectSchema,
  LAYER_TYPE_LABELS,
  MaterialLayerSchema,
  MaterialTemplateSchema,
  ObjectRelationSchema,
  OPPOSITE_SIDES,
  ProjectSchema,
  RELATION_ANCHOR_LABELS,
  RELATION_DIMENSION_FIELDS,
  RELATION_FIELD_LABELS,
  RELATION_MODE_LABELS,
  RELATION_POSITION_FIELDS,
  RELATION_TYPE_LABELS,
  SIDE_LABELS,
} from "../index";

describe("types", () => {
  test("ProjectSchema validates a valid project", () => {
    const project = ProjectSchema.parse({
      id: "proj-1",
      name: "Mój projekt",
      description: "Opis",
      grid_size_mm: 100,
      grid_visible: 1,
      created_at: 1000,
      updated_at: 1000,
    });
    expect(project.name).toBe("Mój projekt");
    expect(project.grid_size_mm).toBe(100);
  });

  test("FurnitureObjectSchema validates a complete object", () => {
    const obj = FurnitureObjectSchema.parse({
      id: "obj-1",
      project_id: "proj-1",
      name: "Bok",
      width: 18,
      height: 720,
      depth: 560,
      position_x: 0,
      position_y: 0,
      position_z: 0,
      rotation_y: 0,
      color: "#8B7355",
      material_type: "wood",
    material_template_id: null,
      component_id: null,
      is_independent: 0,
      created_at: 1,
      updated_at: 1,
    });
    expect(obj.name).toBe("Bok");
    expect(obj.width).toBe(18);
    expect(obj.is_independent).toBe(0);
  });

  test("FurnitureObjectSchema accepts null for optional fields", () => {
    const obj = FurnitureObjectSchema.parse({
      id: "obj-1",
      project_id: "proj-1",
      name: "Panel",
      width: 600,
      height: 18,
      depth: 400,
      position_x: 0,
      position_y: 0,
      position_z: 0,
      rotation_y: 0,
      color: "#8B7355",
      material_type: "wood",
    material_template_id: null,
      component_id: null,
      is_independent: 0,
      created_at: 1,
      updated_at: 1,
    });
    expect(obj.material_template_id).toBeNull();
    expect(obj.component_id).toBeNull();
  });

  test("MaterialTemplateSchema validates template with layers", () => {
    const template = MaterialTemplateSchema.parse({
      id: "tmpl-1",
      name: "Dąb",
      description: "Okleina dębowa",
      base_color: "#C4A882",
      created_at: 1,
      updated_at: 1,
      layers: [],
    });
    expect(template.name).toBe("Dąb");
    expect(template.layers).toHaveLength(0);
  });

  test("MaterialLayerSchema validates a layer", () => {
    const layer = MaterialLayerSchema.parse({
      id: "layer-1",
      template_id: "tmpl-1",
      side: "top",
      layer_type: "veneer",
      color: "#D4A574",
      thickness: 0.5,
      is_bilateral: 0,
      opposite_side: null,
      sort_order: 0,
      created_at: 1,
    });
    expect(layer.side).toBe("top");
    expect(layer.layer_type).toBe("veneer");
  });

  test("ObjectRelationSchema validates a dimension relation", () => {
    const rel = ObjectRelationSchema.parse({
      id: "rel-1",
      project_id: "proj-1",
      source_object_id: "src",
      target_object_id: "tgt",
      relation_type: "dimension",
      source_field: "width",
      target_field: "width",
      mode: "direct",
      source_anchor: null,
      target_anchor: null,
      offset_mm: 0,
      created_at: 1,
    });
    expect(rel.relation_type).toBe("dimension");
    expect(rel.mode).toBe("direct");
  });

  test("ObjectRelationSchema validates an attachment relation", () => {
    const rel = ObjectRelationSchema.parse({
      id: "rel-2",
      project_id: "proj-1",
      source_object_id: "src",
      target_object_id: "tgt",
      relation_type: "attachment",
      source_field: "position_x",
      target_field: "position_x",
      mode: "anchor",
      source_anchor: "end",
      target_anchor: "start",
      offset_mm: 18,
      created_at: 1,
    });
    expect(rel.source_anchor).toBe("end");
    expect(rel.target_anchor).toBe("start");
  });

  test("ComponentGroupSchema validates a component", () => {
    const cg = ComponentGroupSchema.parse({
      id: "cg-1",
      project_id: "proj-1",
      name: "Boki korpusu",
      created_at: 1,
    });
    expect(cg.name).toBe("Boki korpusu");
  });

  test("OPPOSITE_SIDES maps each side to its opposite", () => {
    expect(OPPOSITE_SIDES.top).toBe("bottom");
    expect(OPPOSITE_SIDES.bottom).toBe("top");
    expect(OPPOSITE_SIDES.left).toBe("right");
    expect(OPPOSITE_SIDES.right).toBe("left");
    expect(OPPOSITE_SIDES.front).toBe("back");
    expect(OPPOSITE_SIDES.back).toBe("front");
  });

  test("SIDE_LABELS has Polish names for all sides", () => {
    expect(SIDE_LABELS.top).toMatch(/[A-ZŁŚŻŹ]/);
    expect(SIDE_LABELS.bottom).toMatch(/[A-ZŁŚ]/);
    expect(SIDE_LABELS.left).toBe("Lewo");
    expect(SIDE_LABELS.right).toBe("Prawo");
    expect(SIDE_LABELS.front).toMatch(/[A-ZŁŚŻŹ]/);
    expect(SIDE_LABELS.back).toMatch(/[A-ZŁŚŻŹ]/);
  });

  test("RELATION_TYPE_LABELS covers dimension and attachment", () => {
    expect(typeof RELATION_TYPE_LABELS.dimension).toBe("string");
    expect(typeof RELATION_TYPE_LABELS.attachment).toBe("string");
  });

  test("RELATION_MODE_LABELS covers all modes", () => {
    const modes = ["direct", "relative", "anchor"] as const;
    for (const mode of modes) {
      expect(typeof RELATION_MODE_LABELS[mode]).toBe("string");
    }
  });

  test("RELATION_TYPES list is complete", () => {
    const types = ["dimension", "attachment"] as const;
    for (const t of types) {
      expect(RELATION_TYPE_LABELS[t]).toBeDefined();
    }
  });

  test("RELATION_ANCHORS list is complete", () => {
    expect(typeof RELATION_ANCHOR_LABELS.start).toBe("string");
    expect(typeof RELATION_ANCHOR_LABELS.center).toBe("string");
    expect(typeof RELATION_ANCHOR_LABELS.end).toBe("string");
  });

  test("RELATION_DIMENSION_FIELDS contains width, height, depth", () => {
    expect(RELATION_DIMENSION_FIELDS).toContain("width");
    expect(RELATION_DIMENSION_FIELDS).toContain("height");
    expect(RELATION_DIMENSION_FIELDS).toContain("depth");
  });

  test("RELATION_POSITION_FIELDS contains position axes", () => {
    expect(RELATION_POSITION_FIELDS).toContain("position_x");
    expect(RELATION_POSITION_FIELDS).toContain("position_y");
    expect(RELATION_POSITION_FIELDS).toContain("position_z");
  });

  test("RELATION_FIELD_LABELS covers all relation fields", () => {
    expect(typeof RELATION_FIELD_LABELS.width).toBe("string");
    expect(typeof RELATION_FIELD_LABELS.height).toBe("string");
    expect(typeof RELATION_FIELD_LABELS.depth).toBe("string");
    expect(typeof RELATION_FIELD_LABELS.position_x).toBe("string");
    expect(typeof RELATION_FIELD_LABELS.position_y).toBe("string");
    expect(typeof RELATION_FIELD_LABELS.position_z).toBe("string");
  });

  test("LAYER_TYPE_LABELS has Polish names for layer types", () => {
    expect(typeof LAYER_TYPE_LABELS.veneer).toBe("string");
    expect(typeof LAYER_TYPE_LABELS.edge_banding).toBe("string");
    expect(typeof LAYER_TYPE_LABELS.paint).toBe("string");
  });
});
