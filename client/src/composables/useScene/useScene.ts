import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ref } from "vue";
import type { MaterialType } from "../../lib/materialTypes";
import {
  MATERIAL_METALNESS,
  MATERIAL_ROUGHNESS,
  METALLIC_MATERIALS,
} from "../../lib/materialTypes";
import type { EdgeRoundingConfig } from "../../lib/objectShapes";
import { DEFAULT_EDGE_ROUNDING } from "../../lib/objectShapes";
import type { SnapAnchorType } from "../../lib/snapAnchors";
import type {
  EdgeBandingConfig,
  FurnitureObject,
  GridConfig,
} from "../../types";
import { DEFAULT_EDGE_BANDING } from "../../types";

// Scale factor: 1 Three.js unit = 1mm
const SCALE = 0.001; // mm → meters (Three.js world units)
const NDC_TO_SCREEN_SCALE = 0.5;
const NDC_TO_SCREEN_OFFSET = 0.5;
const FACE_HIGHLIGHT_OFFSET = 0.001; // small offset to avoid z-fighting with the face mesh
const SNAP_FACE_MARKER_RADIUS = 0.01;
const SNAP_EDGE_MARKER_RADIUS = 0.012;
const SNAP_SELECTED_SCALE = 1.35;
const THUMBNAIL_WIDTH = 400;
const THUMBNAIL_HEIGHT = 225;
const THUMBNAIL_JPEG_QUALITY = 0.75;
const MIN_RENDER_SIZE = 1;

export const DEFAULT_SHADOW_MAP_TYPE = THREE.PCFShadowMap;

type SceneHitLike = {
  name?: string;
  userData?: {
    type?: string;
    id?: string;
  };
};

export type SceneClickTarget =
  | { type: "object"; id: string }
  | { type: "floor" }
  | { type: "background" };

export function resolveSceneClickTargetFromHits(
  hits: readonly SceneHitLike[],
): SceneClickTarget {
  for (const hit of hits) {
    const id = hit.userData?.id;
    if (hit.userData?.type === "furniture" && typeof id === "string") {
      return { type: "object", id };
    }
    if (hit.name === "__floor__") {
      return { type: "floor" };
    }
  }

  return { type: "background" };
}

type CanvasSizeSource = Pick<
  HTMLCanvasElement,
  "clientWidth" | "clientHeight" | "getBoundingClientRect" | "parentElement"
>;

export function resolveCanvasRenderSize(canvas: CanvasSizeSource): {
  width: number;
  height: number;
} {
  const rect = canvas.getBoundingClientRect();
  const parentWidth = canvas.parentElement?.clientWidth ?? 0;
  const parentHeight = canvas.parentElement?.clientHeight ?? 0;

  return {
    width: Math.max(
      MIN_RENDER_SIZE,
      Math.round(rect.width),
      canvas.clientWidth,
      parentWidth,
    ),
    height: Math.max(
      MIN_RENDER_SIZE,
      Math.round(rect.height),
      canvas.clientHeight,
      parentHeight,
    ),
  };
}

type SceneSnapAnchorMarker = {
  objectId: string;
  anchorIndex: number;
  type: SnapAnchorType;
  x: number;
  y: number;
  z: number;
  selected: boolean;
};

export function useScene(canvas: HTMLCanvasElement) {
  const selectedIds = ref<Set<string>>(new Set());
  const objectMeshMap = new Map<string, THREE.Mesh>();
  const initialCanvasSize = resolveCanvasRenderSize(canvas);

  // ---- Renderer ----
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initialCanvasSize.width, initialCanvasSize.height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = DEFAULT_SHADOW_MAP_TYPE;
  renderer.setClearColor(0x1a1a2e);

  // ---- Scene ----
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a1a2e, 0.002);

  const snapAnchorGroup = new THREE.Group();
  snapAnchorGroup.name = "__snap_anchors__";
  scene.add(snapAnchorGroup);

  const snapFaceGeometry = new THREE.SphereGeometry(
    SNAP_FACE_MARKER_RADIUS,
    18,
    18,
  );
  const snapEdgeGeometry = new THREE.OctahedronGeometry(
    SNAP_EDGE_MARKER_RADIUS,
    0,
  );

  // ---- Camera ----
  const camera = new THREE.PerspectiveCamera(
    45,
    initialCanvasSize.width / initialCanvasSize.height,
    0.01,
    1000,
  );
  camera.position.set(2, 1.5, 2);
  camera.lookAt(0, 0, 0);

  // ---- Controls ----
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 0.1;
  controls.maxDistance = 50;
  controls.maxPolarAngle = Math.PI / 2 + 0.1;

  // ---- Lights ----
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(5, 8, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.top = 10;
  dirLight.shadow.camera.bottom = -10;
  dirLight.shadow.camera.left = -10;
  dirLight.shadow.camera.right = 10;
  scene.add(dirLight);

  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a4040, 0.4);
  scene.add(hemiLight);

  // ---- Floor ----
  const floorGeom = new THREE.PlaneGeometry(20, 20);
  const floorMat = new THREE.MeshLambertMaterial({
    color: 0x2a2a3e,
    side: THREE.DoubleSide,
  });
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = "__floor__";
  scene.add(floor);

  // ---- Grid ----
  let gridHelper: THREE.GridHelper | null = null;
  let gridLines: THREE.Group | null = null;

  function buildGrid(config: GridConfig) {
    // Remove old grid
    if (gridHelper) {
      scene.remove(gridHelper);
      gridHelper.dispose();
      gridHelper = null;
    }
    if (gridLines) {
      scene.remove(gridLines);
      gridLines = null;
    }

    if (!config.visible) return;

    const cellSize = config.sizeX * SCALE; // Convert mm to scene units
    const divisions = Math.min(Math.floor(10 / cellSize), 200);
    const totalSize = divisions * cellSize;

    gridHelper = new THREE.GridHelper(totalSize, divisions, 0x444466, 0x333355);
    gridHelper.position.y = 0.001;
    scene.add(gridHelper);
  }

  buildGrid({ visible: true, sizeX: 100, sizeY: 100, sizeZ: 100, unit: "mm" });

  // ---- Object Materials ----
  // Cache for shared environment map to avoid recreating for every metallic object
  let _envMap: THREE.Texture | null = null;

  function getMetalEnvMap(): THREE.Texture {
    if (!_envMap) {
      // Create a simple gradient environment map for metallic reflections
      // This is much cheaper than loading an HDR and provides convincing results
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x444455);
      // Add a bright upper hemisphere and darker lower to simulate studio lighting
      const envLight1 = new THREE.DirectionalLight(0xffffff, 2);
      envLight1.position.set(0, 1, 0);
      envScene.add(envLight1);
      const envLight2 = new THREE.DirectionalLight(0xccccdd, 1);
      envLight2.position.set(1, 0.5, 1);
      envScene.add(envLight2);
      _envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
      pmremGenerator.dispose();
    }
    return _envMap;
  }

  function createObjectMaterial(
    color: string,
    selected: boolean,
    materialType?: string,
  ): THREE.Material {
    const isMetallic = METALLIC_MATERIALS.has(
      (materialType ?? "wood") as MaterialType,
    );

    if (isMetallic) {
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        metalness: MATERIAL_METALNESS[materialType as MaterialType] ?? 0.8,
        roughness: MATERIAL_ROUGHNESS[materialType as MaterialType] ?? 0.35,
        envMap: getMetalEnvMap(),
        envMapIntensity: 1.0,
      });
      if (selected) {
        mat.emissive.set(0x2244aa);
        mat.emissiveIntensity = 0.3;
      }
      return mat;
    }

    const mat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(color),
      shininess: 30,
      specular: new THREE.Color(0x333333),
    });
    if (selected) {
      mat.emissive.set(0x2244aa);
      mat.emissiveIntensity = 0.3;
    }
    return mat;
  }

  // ---- Selection wireframe ----
  function addSelectionWireframe(mesh: THREE.Mesh) {
    // Remove existing
    const existing = mesh.children.find((c) => c.name === "__selection__");
    if (existing) mesh.remove(existing);

    const edges = new THREE.EdgesGeometry(mesh.geometry);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x4488ff,
      linewidth: 2,
    });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    wireframe.name = "__selection__";
    mesh.add(wireframe);
  }

  function removeSelectionWireframe(mesh: THREE.Mesh) {
    const existing = mesh.children.find((c) => c.name === "__selection__");
    if (existing) mesh.remove(existing);
  }

  // ---- Edge banding visualization (dashed lines) ----
  function parseEdgeBanding(obj: FurnitureObject): EdgeBandingConfig | null {
    if (!obj.edge_banding_json) return null;
    try {
      const config = {
        ...DEFAULT_EDGE_BANDING,
        ...JSON.parse(obj.edge_banding_json),
      };
      const hasAny =
        config.frontThickness > 0 ||
        config.backThickness > 0 ||
        config.topThickness > 0 ||
        config.bottomThickness > 0 ||
        config.leftThickness > 0 ||
        config.rightThickness > 0;
      return hasAny ? config : null;
    } catch {
      return null;
    }
  }

  function removeEdgeBandingVisualization(mesh: THREE.Mesh) {
    const children = mesh.children.filter((c) =>
      c.name.startsWith("__edge_banding_"),
    );
    for (const child of children) {
      mesh.remove(child);
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
  }

  function addEdgeBandingVisualization(
    mesh: THREE.Mesh,
    config: EdgeBandingConfig,
  ) {
    removeEdgeBandingVisualization(mesh);

    const geom = mesh.geometry as THREE.BoxGeometry;
    const { width: w, height: h, depth: d } = geom.parameters;
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;
    const offset = 0.0005; // small offset to prevent z-fighting

    // Create dashed line patterns for each active edge/face
    const sides: Array<{
      name: string;
      thickness: number;
      color: string;
      points: [THREE.Vector3, THREE.Vector3][];
    }> = [];

    if (config.frontThickness > 0) {
      // Front face - draw dashed rectangle outline on the front
      const z = hd + offset;
      sides.push({
        name: "front",
        thickness: config.frontThickness,
        color: config.frontColor,
        points: [
          [new THREE.Vector3(-hw, -hh, z), new THREE.Vector3(hw, -hh, z)],
          [new THREE.Vector3(hw, -hh, z), new THREE.Vector3(hw, hh, z)],
          [new THREE.Vector3(hw, hh, z), new THREE.Vector3(-hw, hh, z)],
          [new THREE.Vector3(-hw, hh, z), new THREE.Vector3(-hw, -hh, z)],
        ],
      });
    }

    if (config.backThickness > 0) {
      const z = -(hd + offset);
      sides.push({
        name: "back",
        thickness: config.backThickness,
        color: config.backColor,
        points: [
          [new THREE.Vector3(-hw, -hh, z), new THREE.Vector3(hw, -hh, z)],
          [new THREE.Vector3(hw, -hh, z), new THREE.Vector3(hw, hh, z)],
          [new THREE.Vector3(hw, hh, z), new THREE.Vector3(-hw, hh, z)],
          [new THREE.Vector3(-hw, hh, z), new THREE.Vector3(-hw, -hh, z)],
        ],
      });
    }

    if (config.topThickness > 0) {
      const y = hh + offset;
      sides.push({
        name: "top",
        thickness: config.topThickness,
        color: config.topColor,
        points: [
          [new THREE.Vector3(-hw, y, -hd), new THREE.Vector3(hw, y, -hd)],
          [new THREE.Vector3(hw, y, -hd), new THREE.Vector3(hw, y, hd)],
          [new THREE.Vector3(hw, y, hd), new THREE.Vector3(-hw, y, hd)],
          [new THREE.Vector3(-hw, y, hd), new THREE.Vector3(-hw, y, -hd)],
        ],
      });
    }

    if (config.bottomThickness > 0) {
      const y = -(hh + offset);
      sides.push({
        name: "bottom",
        thickness: config.bottomThickness,
        color: config.bottomColor,
        points: [
          [new THREE.Vector3(-hw, y, -hd), new THREE.Vector3(hw, y, -hd)],
          [new THREE.Vector3(hw, y, -hd), new THREE.Vector3(hw, y, hd)],
          [new THREE.Vector3(hw, y, hd), new THREE.Vector3(-hw, y, hd)],
          [new THREE.Vector3(-hw, y, hd), new THREE.Vector3(-hw, y, -hd)],
        ],
      });
    }

    if (config.leftThickness > 0) {
      const x = -(hw + offset);
      sides.push({
        name: "left",
        thickness: config.leftThickness,
        color: config.leftColor,
        points: [
          [new THREE.Vector3(x, -hh, -hd), new THREE.Vector3(x, -hh, hd)],
          [new THREE.Vector3(x, -hh, hd), new THREE.Vector3(x, hh, hd)],
          [new THREE.Vector3(x, hh, hd), new THREE.Vector3(x, hh, -hd)],
          [new THREE.Vector3(x, hh, -hd), new THREE.Vector3(x, -hh, -hd)],
        ],
      });
    }

    if (config.rightThickness > 0) {
      const x = hw + offset;
      sides.push({
        name: "right",
        thickness: config.rightThickness,
        color: config.rightColor,
        points: [
          [new THREE.Vector3(x, -hh, -hd), new THREE.Vector3(x, -hh, hd)],
          [new THREE.Vector3(x, -hh, hd), new THREE.Vector3(x, hh, hd)],
          [new THREE.Vector3(x, hh, hd), new THREE.Vector3(x, hh, -hd)],
          [new THREE.Vector3(x, hh, -hd), new THREE.Vector3(x, -hh, -hd)],
        ],
      });
    }

    for (const side of sides) {
      const positions: number[] = [];
      for (const [start, end] of side.points) {
        positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
      }
      const lineGeom = new THREE.BufferGeometry();
      lineGeom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      const lineMat = new THREE.LineDashedMaterial({
        color: new THREE.Color(side.color),
        dashSize: 0.008,
        gapSize: 0.004,
        linewidth: 1,
      });
      const lineSegments = new THREE.LineSegments(lineGeom, lineMat);
      lineSegments.computeLineDistances();
      lineSegments.name = `__edge_banding_${side.name}__`;
      mesh.add(lineSegments);
    }
  }

  function updateEdgeBandingVisualization(
    mesh: THREE.Mesh,
    obj: FurnitureObject,
  ) {
    const config = parseEdgeBanding(obj);
    if (config) {
      addEdgeBandingVisualization(mesh, config);
    } else {
      removeEdgeBandingVisualization(mesh);
    }
  }

  // ---- Geometry creation based on shape ----
  function createObjectGeometry(obj: FurnitureObject): THREE.BufferGeometry {
    const w = obj.width * SCALE;
    const h = obj.height * SCALE;
    const d = obj.depth * SCALE;
    const shape = obj.object_shape || "box";

    switch (shape) {
      case "sphere": {
        // Use the average of width/height/depth as diameter
        const radius = Math.max(w, h, d) / 2;
        return new THREE.SphereGeometry(radius, 32, 24);
      }
      case "cylinder": {
        // Width/depth = diameter, height = height
        const cylRadius = Math.max(w, d) / 2;
        return new THREE.CylinderGeometry(cylRadius, cylRadius, h, 32);
      }
      case "cube": {
        // Use the largest dimension for all sides
        const side = Math.max(w, h, d);
        return new THREE.BoxGeometry(side, side, side);
      }
      case "box":
      default: {
        // Check for edge rounding
        const rounding = parseEdgeRounding(obj);
        if (rounding) {
          return createRoundedBoxGeometry(w, h, d, rounding);
        }
        return new THREE.BoxGeometry(w, h, d);
      }
    }
  }

  function parseEdgeRounding(obj: FurnitureObject): EdgeRoundingConfig | null {
    if (!obj.edge_rounding_json) return null;
    try {
      const config = {
        ...DEFAULT_EDGE_ROUNDING,
        ...JSON.parse(obj.edge_rounding_json),
      };
      const hasAny =
        config.topLeft > 0 ||
        config.topRight > 0 ||
        config.bottomLeft > 0 ||
        config.bottomRight > 0;
      return hasAny ? config : null;
    } catch {
      return null;
    }
  }

  /**
   * Creates a box geometry with rounded vertical edges (fillets).
   * Based on carpentry standards where rounded corners are cylindrical arcs
   * that maintain the object's thickness and are always cut perpendicular.
   */
  function createRoundedBoxGeometry(
    w: number,
    h: number,
    d: number,
    rounding: EdgeRoundingConfig,
  ): THREE.BufferGeometry {
    const hw = w / 2;
    const hd = d / 2;
    const segments = 8; // segments per corner arc

    // Create a 2D shape (XZ plane) with rounded corners, then extrude vertically
    const shape = new THREE.Shape();

    const tl = Math.min(rounding.topLeft * SCALE, hw, hd);
    const tr = Math.min(rounding.topRight * SCALE, hw, hd);
    const br = Math.min(rounding.bottomRight * SCALE, hw, hd);
    const bl = Math.min(rounding.bottomLeft * SCALE, hw, hd);

    // Start from bottom-left, going clockwise (viewed from top)
    // Bottom edge (from bottom-left to bottom-right)
    shape.moveTo(-hw + bl, -hd);
    shape.lineTo(hw - br, -hd);

    // Bottom-right corner arc
    if (br > 0) {
      shape.absarc(hw - br, -hd + br, br, -Math.PI / 2, 0, false);
    }

    // Right edge
    shape.lineTo(hw, hd - tr);

    // Top-right corner arc
    if (tr > 0) {
      shape.absarc(hw - tr, hd - tr, tr, 0, Math.PI / 2, false);
    }

    // Top edge
    shape.lineTo(-hw + tl, hd);

    // Top-left corner arc
    if (tl > 0) {
      shape.absarc(-hw + tl, hd - tl, tl, Math.PI / 2, Math.PI, false);
    }

    // Left edge
    shape.lineTo(-hw, -hd + bl);

    // Bottom-left corner arc
    if (bl > 0) {
      shape.absarc(-hw + bl, -hd + bl, bl, Math.PI, (3 * Math.PI) / 2, false);
    }

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: h,
      bevelEnabled: false,
      curveSegments: segments,
    };

    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Rotate so the extrusion goes along Y axis (up) instead of Z
    geom.rotateX(-Math.PI / 2);
    // Center vertically
    geom.translate(0, h / 2, 0);

    return geom;
  }

  // ---- Add / Update / Remove Objects ----
  function addObject(obj: FurnitureObject) {
    const geom = createObjectGeometry(obj);
    const mat = createObjectMaterial(
      obj.color,
      selectedIds.value.has(obj.id),
      obj.material_type,
    );
    const mesh = new THREE.Mesh(geom, mat);

    mesh.position.set(
      obj.position_x * SCALE,
      (obj.position_y + obj.height / 2) * SCALE, // center vertically: place base at position_y, mesh center at +half height
      obj.position_z * SCALE,
    );
    mesh.rotation.y = obj.rotation_y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = obj.id;
    mesh.userData = { type: "furniture", id: obj.id };

    if (selectedIds.value.has(obj.id)) {
      addSelectionWireframe(mesh);
    }

    // Add edge banding visualization if applicable
    updateEdgeBandingVisualization(mesh, obj);

    scene.add(mesh);
    objectMeshMap.set(obj.id, mesh);
  }

  function updateObject(obj: FurnitureObject) {
    const mesh = objectMeshMap.get(obj.id);
    if (!mesh) {
      addObject(obj);
      return;
    }

    // Always recreate geometry when updating (shape/rounding/dimensions may change)
    // This is simpler and more reliable than trying to diff all possible geometry params
    mesh.geometry.dispose();
    mesh.geometry = createObjectGeometry(obj);
    // Rebuild selection wireframe if selected
    if (selectedIds.value.has(obj.id)) {
      addSelectionWireframe(mesh);
    }

    // Update material - check if material type changed (need full replacement)
    const currentMat = mesh.material as THREE.Material;
    const currentIsMetallic = currentMat instanceof THREE.MeshStandardMaterial;
    const newIsMetallic = METALLIC_MATERIALS.has(
      (obj.material_type ?? "wood") as MaterialType,
    );

    if (currentIsMetallic !== newIsMetallic) {
      // Material type category changed, need full replacement
      currentMat.dispose();
      mesh.material = createObjectMaterial(
        obj.color,
        selectedIds.value.has(obj.id),
        obj.material_type,
      );
    } else {
      // Same material category, just update color and selection state
      const mat = mesh.material as
        | THREE.MeshPhongMaterial
        | THREE.MeshStandardMaterial;
      mat.color.set(obj.color);
      const isSelected = selectedIds.value.has(obj.id);
      if (isSelected) {
        mat.emissive.set(0x2244aa);
        mat.emissiveIntensity = 0.3;
      } else {
        mat.emissive.set(0x000000);
        mat.emissiveIntensity = 0;
      }
    }

    // Update position
    mesh.position.set(
      obj.position_x * SCALE,
      (obj.position_y + obj.height / 2) * SCALE, // center vertically: base at position_y, mesh center at +half height
      obj.position_z * SCALE,
    );
    mesh.rotation.y = obj.rotation_y;

    // Update edge banding visualization
    updateEdgeBandingVisualization(mesh, obj);
  }

  function removeObject(id: string) {
    // Clear hover highlight before removing the mesh so the children can be
    // properly disposed while the mesh is still accessible via objectMeshMap.
    if (id === hoverObjectId) {
      clearHoverHighlight();
    }
    const mesh = objectMeshMap.get(id);
    if (!mesh) return;
    scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    objectMeshMap.delete(id);
  }

  function syncObjects(
    objects: readonly FurnitureObject[],
    selIds: readonly string[],
  ) {
    const newIds = new Set(objects.map((o) => o.id));
    selectedIds.value = new Set(selIds);

    // Remove deleted objects
    for (const [id] of objectMeshMap) {
      if (!newIds.has(id)) removeObject(id);
    }

    // Add / update objects
    for (const obj of objects) {
      if (objectMeshMap.has(obj.id)) {
        updateObject(obj);
      } else {
        addObject(obj);
      }
    }

    // Update selection highlights
    for (const [id, mesh] of objectMeshMap) {
      const mat = mesh.material as
        | THREE.MeshPhongMaterial
        | THREE.MeshStandardMaterial;
      if (selIds.includes(id)) {
        mat.emissive.set(0x2244aa);
        mat.emissiveIntensity = 0.3;
        addSelectionWireframe(mesh);
      } else {
        mat.emissive.set(0x000000);
        mat.emissiveIntensity = 0;
        removeSelectionWireframe(mesh);
      }
    }
  }

  // ---- Raycasting for selection ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function updatePointerFromMouse(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickObject(event: MouseEvent): string | null {
    const target = pickSceneTarget(event);
    return target.type === "object" ? target.id : null;
  }

  function pickSceneTarget(event: MouseEvent): SceneClickTarget {
    updatePointerFromMouse(event);
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(
      [...objectMeshMap.values(), floor],
      false,
    );

    return resolveSceneClickTargetFromHits(
      intersects.map((hit) => hit.object as SceneHitLike),
    );
  }

  function pickObjectWithFace(
    event: MouseEvent,
  ): { id: string; faceNormal: THREE.Vector3 } | null {
    updatePointerFromMouse(event);
    raycaster.setFromCamera(pointer, camera);
    const meshes = Array.from(objectMeshMap.values());
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const id = (hit.object as THREE.Mesh).userData.id as string;
      if (id && hit.face) {
        // face.normal is in local mesh space; keep it local since highlight meshes are also children
        const faceNormal = hit.face.normal.clone();
        return { id, faceNormal };
      }
    }
    return null;
  }

  function clearSnapAnchors() {
    while (snapAnchorGroup.children.length > 0) {
      const child = snapAnchorGroup.children[0] as THREE.Mesh;
      snapAnchorGroup.remove(child);
      const material = child.material;
      if (Array.isArray(material)) {
        for (const item of material) {
          item.dispose();
        }
      } else {
        material.dispose();
      }
    }
  }

  function setSnapAnchors(markers: SceneSnapAnchorMarker[]) {
    clearSnapAnchors();

    for (const marker of markers) {
      const material = new THREE.MeshBasicMaterial({
        color: marker.type === "face" ? 0xef4444 : 0x3b82f6,
        transparent: true,
        opacity: marker.selected ? 1 : 0.92,
        depthTest: false,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(
        marker.type === "face" ? snapFaceGeometry : snapEdgeGeometry,
        material,
      );
      mesh.position.set(marker.x, marker.y, marker.z);
      mesh.renderOrder = 999;
      if (marker.selected) {
        mesh.scale.setScalar(SNAP_SELECTED_SCALE);
      }
      mesh.userData = {
        kind: "snap-anchor",
        objectId: marker.objectId,
        anchorIndex: marker.anchorIndex,
      };
      snapAnchorGroup.add(mesh);
    }
  }

  function pickSnapAnchor(
    event: MouseEvent,
  ): { objectId: string; anchorIndex: number } | null {
    if (snapAnchorGroup.children.length === 0) {
      return null;
    }

    updatePointerFromMouse(event);
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(
      snapAnchorGroup.children,
      true,
    );

    for (const hit of intersects) {
      const marker = hit.object as THREE.Object3D;
      const objectId = marker.userData.objectId as string | undefined;
      const anchorIndex = marker.userData.anchorIndex as number | undefined;
      if (objectId && typeof anchorIndex === "number") {
        return { objectId, anchorIndex };
      }
    }

    return null;
  }

  // ---- Hover / snap highlight ----
  let hoverObjectId: string | null = null;

  function clearHoverHighlight() {
    if (!hoverObjectId) return;
    const mesh = objectMeshMap.get(hoverObjectId);
    if (mesh) {
      const hoverEdge = mesh.children.find((c) => c.name === "__hover_edge__");
      if (hoverEdge) {
        mesh.remove(hoverEdge);
        (hoverEdge as THREE.LineSegments).geometry.dispose();
        (
          (hoverEdge as THREE.LineSegments).material as THREE.Material
        ).dispose();
      }
      const hoverFace = mesh.children.find((c) => c.name === "__hover_face__");
      if (hoverFace) {
        mesh.remove(hoverFace);
        (hoverFace as THREE.Mesh).geometry.dispose();
        ((hoverFace as THREE.Mesh).material as THREE.Material).dispose();
      }
    }
    hoverObjectId = null;
  }

  function setHoverHighlight(
    objectId: string | null,
    faceNormal?: THREE.Vector3,
  ) {
    if (objectId === hoverObjectId) {
      // Update face highlight if same object but different face
      if (objectId && faceNormal) {
        const mesh = objectMeshMap.get(objectId);
        if (mesh) {
          const hoverFace = mesh.children.find(
            (c) => c.name === "__hover_face__",
          );
          if (hoverFace) {
            mesh.remove(hoverFace);
            (hoverFace as THREE.Mesh).geometry.dispose();
            ((hoverFace as THREE.Mesh).material as THREE.Material).dispose();
          }
          const faceMesh = buildFaceHighlight(mesh, faceNormal);
          if (faceMesh) mesh.add(faceMesh);
        }
      }
      return;
    }

    clearHoverHighlight();

    if (!objectId) return;

    const mesh = objectMeshMap.get(objectId);
    if (!mesh) return;

    hoverObjectId = objectId;

    // Add edge wireframe for the whole object
    const edges = new THREE.EdgesGeometry(mesh.geometry);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffaa00 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    wireframe.name = "__hover_edge__";
    mesh.add(wireframe);

    // Add face highlight if normal provided
    if (faceNormal) {
      const faceMesh = buildFaceHighlight(mesh, faceNormal);
      if (faceMesh) mesh.add(faceMesh);
    }
  }

  function buildFaceHighlight(
    mesh: THREE.Mesh,
    faceNormal: THREE.Vector3,
  ): THREE.Mesh | null {
    const geom = mesh.geometry as THREE.BoxGeometry;
    const { width: w, height: h, depth: d } = geom.parameters;
    const OFFSET = FACE_HIGHLIGHT_OFFSET;

    const nx = Math.round(faceNormal.x);
    const ny = Math.round(faceNormal.y);
    const nz = Math.round(faceNormal.z);

    let planeGeom: THREE.PlaneGeometry;
    const position = new THREE.Vector3();
    const euler = new THREE.Euler();

    if (nx === 1) {
      planeGeom = new THREE.PlaneGeometry(d, h);
      position.set(w / 2 + OFFSET, 0, 0);
      euler.set(0, Math.PI / 2, 0);
    } else if (nx === -1) {
      planeGeom = new THREE.PlaneGeometry(d, h);
      position.set(-(w / 2) - OFFSET, 0, 0);
      euler.set(0, -Math.PI / 2, 0);
    } else if (ny === 1) {
      planeGeom = new THREE.PlaneGeometry(w, d);
      position.set(0, h / 2 + OFFSET, 0);
      euler.set(-Math.PI / 2, 0, 0);
    } else if (ny === -1) {
      planeGeom = new THREE.PlaneGeometry(w, d);
      position.set(0, -(h / 2) - OFFSET, 0);
      euler.set(Math.PI / 2, 0, 0);
    } else if (nz === 1) {
      planeGeom = new THREE.PlaneGeometry(w, h);
      position.set(0, 0, d / 2 + OFFSET);
      euler.set(0, 0, 0);
    } else if (nz === -1) {
      planeGeom = new THREE.PlaneGeometry(w, h);
      position.set(0, 0, -(d / 2) - OFFSET);
      euler.set(0, Math.PI, 0);
    } else {
      return null;
    }

    const mat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthTest: false,
    });

    const faceMesh = new THREE.Mesh(planeGeom, mat);
    faceMesh.position.copy(position);
    faceMesh.rotation.copy(euler);
    faceMesh.name = "__hover_face__";
    return faceMesh;
  }

  function projectObjectToScreen(id: string) {
    const mesh = objectMeshMap.get(id);
    if (!mesh) return null;

    const position = mesh.position.clone().project(camera);
    // Three.js projected NDC coordinates are visible only within the [-1, 1] range.
    if (position.z < -1 || position.z > 1) {
      return null;
    }

    return {
      x:
        (position.x * NDC_TO_SCREEN_SCALE + NDC_TO_SCREEN_OFFSET) *
        canvas.clientWidth,
      y:
        (-position.y * NDC_TO_SCREEN_SCALE + NDC_TO_SCREEN_OFFSET) *
        canvas.clientHeight,
    };
  }

  /**
   * Projects an arbitrary world-space point (in mm) to 2-D canvas coordinates.
   */
  function projectWorldPointToScreen(
    worldXMm: number,
    worldYMm: number,
    worldZMm: number,
  ): { x: number; y: number } | null {
    const vec = new THREE.Vector3(
      worldXMm * SCALE,
      worldYMm * SCALE,
      worldZMm * SCALE,
    ).project(camera);
    if (vec.z < -1 || vec.z > 1) return null;
    return {
      x:
        (vec.x * NDC_TO_SCREEN_SCALE + NDC_TO_SCREEN_OFFSET) *
        canvas.clientWidth,
      y:
        (-vec.y * NDC_TO_SCREEN_SCALE + NDC_TO_SCREEN_OFFSET) *
        canvas.clientHeight,
    };
  }

  // Drag-to-move support
  const isDragging = ref(false);
  let dragObjectId: string | null = null;
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const dragOffset = new THREE.Vector3();

  function startDrag(
    event: MouseEvent,
    objectId: string,
    onDragEnd: (id: string, x: number, z: number) => void,
    getSnapPosition?: (
      id: string,
      rawX: number,
      rawZ: number,
    ) => { x: number; z: number } | null,
    companionIds?: string[],
  ) {
    dragObjectId = objectId;
    isDragging.value = true;
    controls.enabled = false;

    const mesh = objectMeshMap.get(objectId);
    if (!mesh) return;

    updatePointerFromMouse(event);
    raycaster.setFromCamera(pointer, camera);
    const planePoint = new THREE.Vector3();
    dragPlane.set(
      new THREE.Vector3(0, 1, 0),
      -mesh.position.y +
        (mesh.geometry as THREE.BoxGeometry).parameters.height / 2,
    );
    raycaster.ray.intersectPlane(dragPlane, planePoint);
    dragOffset.copy(mesh.position).sub(planePoint);

    // Record the starting (X, Z) of the primary mesh and all companions so we
    // can compute per-frame deltas and keep the group moving as a rigid unit.
    const primaryOriginalX = mesh.position.x / SCALE;
    const primaryOriginalZ = mesh.position.z / SCALE;

    const companionOriginals = new Map<string, { x: number; z: number }>();
    for (const cId of companionIds ?? []) {
      const cMesh = objectMeshMap.get(cId);
      if (cMesh) {
        companionOriginals.set(cId, {
          x: cMesh.position.x / SCALE,
          z: cMesh.position.z / SCALE,
        });
      }
    }

    let lastX = mesh.position.x / SCALE;
    let lastZ = mesh.position.z / SCALE;

    const handleMove = (e: MouseEvent) => {
      updatePointerFromMouse(e);
      raycaster.setFromCamera(pointer, camera);
      const hitPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(dragPlane, hitPoint);
      if (hitPoint && dragObjectId) {
        const newPos = hitPoint.add(dragOffset);
        const rawX = newPos.x / SCALE;
        const rawZ = newPos.z / SCALE;

        let finalX = rawX;
        let finalZ = rawZ;

        if (getSnapPosition) {
          const snapped = getSnapPosition(dragObjectId, rawX, rawZ);
          if (snapped) {
            finalX = snapped.x;
            finalZ = snapped.z;
          }
        }

        const dragMesh = objectMeshMap.get(dragObjectId);
        if (dragMesh) {
          dragMesh.position.x = finalX * SCALE;
          dragMesh.position.z = finalZ * SCALE;
        }
        lastX = finalX;
        lastZ = finalZ;

        // Move companion meshes by the same delta as the primary object.
        const dx = finalX - primaryOriginalX;
        const dz = finalZ - primaryOriginalZ;
        for (const [cId, orig] of companionOriginals) {
          const cMesh = objectMeshMap.get(cId);
          if (cMesh) {
            cMesh.position.x = (orig.x + dx) * SCALE;
            cMesh.position.z = (orig.z + dz) * SCALE;
          }
        }
      }
    };

    const handleUp = () => {
      isDragging.value = false;
      if (dragObjectId) {
        onDragEnd(dragObjectId, lastX, lastZ);
      }
      dragObjectId = null;
      controls.enabled = true;
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("mouseup", handleUp);
    };

    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseup", handleUp);
  }

  // ---- Resize ----
  function resize() {
    const { width: w, height: h } = resolveCanvasRenderSize(canvas);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  if (canvas.parentElement) {
    resizeObserver.observe(canvas.parentElement);
  }
  requestAnimationFrame(resize);

  // ---- Render Loop ----
  let animFrameId: number;
  function animate() {
    animFrameId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // ---- Cleanup ----
  function dispose() {
    cancelAnimationFrame(animFrameId);
    resizeObserver.disconnect();
    controls.dispose();
    if (_envMap) {
      _envMap.dispose();
      _envMap = null;
    }
    if (typeof renderer.forceContextLoss === "function") {
      renderer.forceContextLoss();
    }
    renderer.dispose();
    clearHoverHighlight();
    clearSnapAnchors();
    snapFaceGeometry.dispose();
    snapEdgeGeometry.dispose();
    for (const [id] of objectMeshMap) removeObject(id);
    objectMeshMap.clear();
  }

  function captureScreenshot(): string {
    try {
      // Force a fresh render so the framebuffer is current
      renderer.render(scene, camera);
      // Draw the main canvas scaled down onto an off-screen canvas
      const offscreen = document.createElement("canvas");
      offscreen.width = THUMBNAIL_WIDTH;
      offscreen.height = THUMBNAIL_HEIGHT;
      const ctx = offscreen.getContext("2d");
      if (!ctx) {
        return "";
      }
      ctx.drawImage(canvas, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
      return offscreen.toDataURL("image/jpeg", THUMBNAIL_JPEG_QUALITY);
    } catch (error) {
      console.error("Failed to capture screenshot", error);
      return "";
    }
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    objectMeshMap,
    selectedIds,
    isDragging,
    buildGrid,
    syncObjects,
    pickSceneTarget,
    pickObject,
    pickObjectWithFace,
    setHoverHighlight,
    clearHoverHighlight,
    setSnapAnchors,
    clearSnapAnchors,
    pickSnapAnchor,
    projectObjectToScreen,
    projectWorldPointToScreen,
    startDrag,
    addObject,
    updateObject,
    removeObject,
    dispose,
    captureScreenshot,
  };
}
