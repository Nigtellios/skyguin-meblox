import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { onUnmounted, ref } from "vue";
import type { FurnitureObject, GridConfig } from "../types";

// Scale factor: 1 Three.js unit = 1mm
const SCALE = 0.001; // mm → meters (Three.js world units)

export function useScene(canvas: HTMLCanvasElement) {
  const selectedIds = ref<Set<string>>(new Set());
  const objectMeshMap = new Map<string, THREE.Mesh>();

  // ---- Renderer ----
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x1a1a2e);

  // ---- Scene ----
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a1a2e, 0.002);

  // ---- Camera ----
  const camera = new THREE.PerspectiveCamera(
    45,
    canvas.clientWidth / canvas.clientHeight,
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
  function createObjectMaterial(
    color: string,
    selected: boolean,
  ): THREE.MeshPhongMaterial {
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

  // ---- Add / Update / Remove Objects ----
  function addObject(obj: FurnitureObject) {
    const w = obj.width * SCALE;
    const h = obj.height * SCALE;
    const d = obj.depth * SCALE;

    const geom = new THREE.BoxGeometry(w, h, d);
    const mat = createObjectMaterial(obj.color, selectedIds.value.has(obj.id));
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

    scene.add(mesh);
    objectMeshMap.set(obj.id, mesh);
  }

  function updateObject(obj: FurnitureObject) {
    const mesh = objectMeshMap.get(obj.id);
    if (!mesh) {
      addObject(obj);
      return;
    }

    // Update geometry if dimensions changed
    const w = obj.width * SCALE;
    const h = obj.height * SCALE;
    const d = obj.depth * SCALE;
    const oldGeom = mesh.geometry as THREE.BoxGeometry;
    const params = oldGeom.parameters;
    if (params.width !== w || params.height !== h || params.depth !== d) {
      mesh.geometry.dispose();
      mesh.geometry = new THREE.BoxGeometry(w, h, d);
      // Rebuild selection wireframe if selected
      if (selectedIds.value.has(obj.id)) {
        addSelectionWireframe(mesh);
      }
    }

    // Update material color
    const mat = mesh.material as THREE.MeshPhongMaterial;
    mat.color.set(obj.color);
    const isSelected = selectedIds.value.has(obj.id);
    if (isSelected) {
      mat.emissive.set(0x2244aa);
      mat.emissiveIntensity = 0.3;
    } else {
      mat.emissive.set(0x000000);
      mat.emissiveIntensity = 0;
    }

    // Update position
    mesh.position.set(
      obj.position_x * SCALE,
      (obj.position_y + obj.height / 2) * SCALE, // center vertically: base at position_y, mesh center at +half height
      obj.position_z * SCALE,
    );
    mesh.rotation.y = obj.rotation_y;
  }

  function removeObject(id: string) {
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
      const mat = mesh.material as THREE.MeshPhongMaterial;
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

  function pickObject(event: MouseEvent): string | null {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const meshes = Array.from(objectMeshMap.values());
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object as THREE.Mesh;
      return (hit.userData.id as string) || null;
    }
    return null;
  }

  // Drag-to-move support
  const isDragging = ref(false);
  let dragObjectId: string | null = null;
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const dragOffset = new THREE.Vector3();

  function startDrag(
    event: MouseEvent,
    objectId: string,
    onPositionChange: (id: string, x: number, z: number) => void,
  ) {
    dragObjectId = objectId;
    isDragging.value = true;
    controls.enabled = false;

    const mesh = objectMeshMap.get(objectId);
    if (!mesh) return;

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const planePoint = new THREE.Vector3();
    dragPlane.set(
      new THREE.Vector3(0, 1, 0),
      -mesh.position.y +
        (mesh.geometry as THREE.BoxGeometry).parameters.height / 2,
    );
    raycaster.ray.intersectPlane(dragPlane, planePoint);
    dragOffset.copy(mesh.position).sub(planePoint);

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hitPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(dragPlane, hitPoint);
      if (hitPoint && dragObjectId) {
        const newPos = hitPoint.add(dragOffset);
        const mesh = objectMeshMap.get(dragObjectId);
        if (mesh) {
          mesh.position.x = newPos.x;
          mesh.position.z = newPos.z;
          onPositionChange(dragObjectId, newPos.x / SCALE, newPos.z / SCALE);
        }
      }
    };

    const handleUp = () => {
      isDragging.value = false;
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
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

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
    renderer.dispose();
    for (const [id] of objectMeshMap) removeObject(id);
    objectMeshMap.clear();
  }

  onUnmounted(dispose);

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
    pickObject,
    startDrag,
    addObject,
    updateObject,
    removeObject,
    dispose,
  };
}
