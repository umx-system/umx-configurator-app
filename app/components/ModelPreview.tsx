import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import decoderWasm from "three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url";
import decoderWrapper from "three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?url";
import { inspectGlb } from "../lib/glb";

function disposeModel(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    geometries.add(child.geometry);
    for (const material of Array.isArray(child.material)
      ? child.material
      : [child.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => {
    texture.dispose();
    if (
      typeof ImageBitmap !== "undefined" &&
      texture.image instanceof ImageBitmap
    )
      texture.image.close();
  });
}

export default function ModelPreview({
  file,
  draftId,
  transform,
  onReady,
}: {
  file: File | null;
  draftId?: string;
  transform: "scene" | "rhino";
  onReady: (ready: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const resetView = useRef<() => void>(() => {});
  const [status, setStatus] = useState<{
    phase: "loading" | "ready" | "error";
    message: string;
  }>({ phase: "loading", message: "正在读取模型…" });
  const hasModel = Boolean(file || draftId);

  useEffect(() => {
    if (!hasModel || !container.current) return;
    const element = container.current;
    const abort = new AbortController();
    let active = true;
    let loaded: THREE.Object3D | null = null;
    let renderer: THREE.WebGLRenderer | undefined;
    let controls: OrbitControls | undefined;
    let environment: THREE.WebGLRenderTarget | undefined;
    let observer: ResizeObserver | undefined;
    let grid: THREE.GridHelper | undefined;
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) =>
      url.endsWith("draco_wasm_wrapper.js")
        ? decoderWrapper
        : url.endsWith("draco_decoder.wasm")
          ? decoderWasm
          : url,
    );
    const draco = new DRACOLoader(manager)
      .setDecoderPath("/draco/")
      .setDecoderConfig({ type: "wasm" })
      .setWorkerLimit(2);
    onReady(false);
    const load = async () => {
      setStatus({ phase: "loading", message: "正在读取并校验模型…" });
      const buffer = file
        ? await file.arrayBuffer()
        : await (async () => {
            const response = await fetch(`/api/model-drafts/${draftId}/file`, {
              signal: abort.signal,
            });
            if (
              !response.ok ||
              !response.headers
                .get("content-type")
                ?.includes("model/gltf-binary")
            )
              throw new Error("已保存模型读取失败，请重新加载预览或替换文件。");
            return response.arrayBuffer();
          })();
      inspectGlb(new Uint8Array(buffer));
      if (!active) return;
      setStatus({ phase: "loading", message: "正在解析 3D 模型…" });
      const loader = new GLTFLoader().setDRACOLoader(draco);
      const gltf = await loader.parseAsync(buffer, "");
      if (!active) {
        disposeModel(gltf.scene);
        return;
      }
      loaded = gltf.scene;
      const content = new THREE.Group();
      if (transform === "rhino") {
        // Match the existing UMX configurator: Rhino has baked vertex offsets.
        loaded.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          const mesh = child.clone(false);
          mesh.position.set(0, 0, 0);
          mesh.quaternion.identity();
          mesh.scale.set(1, 1, 1);
          mesh.updateMatrix();
          content.add(mesh);
        });
      } else content.add(loaded);
      const box = new THREE.Box3().setFromObject(content);
      const size = box.getSize(new THREE.Vector3());
      if (
        box.isEmpty() ||
        !Number.isFinite(size.length()) ||
        size.length() <= 0
      )
        throw new Error("模型没有可预览的几何体");
      const center = box.getCenter(new THREE.Vector3());
      const extent = Math.max(size.x, size.y, size.z);
      content.position.set(-center.x, -box.min.y, -center.z);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#f4f4f2");
      scene.add(content);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.domElement.setAttribute(
        "aria-label",
        "模块 3D 预览，可拖动旋转和滚轮缩放",
      );
      renderer.domElement.setAttribute("role", "img");
      element.appendChild(renderer.domElement);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      environment = pmrem.fromScene(room, 0.04);
      scene.environment = environment.texture;
      room.dispose();
      pmrem.dispose();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2));
      grid = new THREE.GridHelper(extent * 3, 12, 0xc0c0c0, 0xe4e4e1);
      grid.position.y = -extent * 0.005;
      scene.add(grid);
      const camera = new THREE.PerspectiveCamera(
        38,
        1,
        extent / 1000,
        extent * 100,
      );
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = false;
      controls.minDistance = extent * 0.15;
      controls.maxDistance = extent * 15;
      const render = () => renderer?.render(scene, camera);
      controls.addEventListener("change", render);
      const fit = () => {
        const distance =
          ((extent / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) *
            1.6) /
          Math.min(camera.aspect, 1);
        controls!.target.set(0, size.y / 2, 0);
        camera.position
          .copy(controls!.target)
          .add(
            new THREE.Vector3(1, 0.65, -1.4)
              .normalize()
              .multiplyScalar(distance),
          );
        controls!.update();
        render();
      };
      resetView.current = fit;
      observer = new ResizeObserver(() => {
        const { width, height } = element.getBoundingClientRect();
        if (!width || !height) return;
        renderer!.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        render();
      });
      const { width, height } = element.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      observer.observe(element);
      fit();
      setStatus({ phase: "ready", message: "模型已加载" });
      onReady(true);
    };
    void load().catch((error) => {
      if (!active) return;
      setStatus({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "无法预览模型，请检查 GLB 文件或浏览器的 3D 支持",
      });
      onReady(false);
    });
    return () => {
      active = false;
      abort.abort();
      observer?.disconnect();
      controls?.dispose();
      draco.dispose();
      resetView.current = () => {};
      if (loaded) disposeModel(loaded);
      if (grid) {
        grid.geometry.dispose();
        (grid.material as THREE.Material).dispose();
      }
      environment?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      renderer?.domElement.remove();
    };
  }, [file, draftId, transform, onReady, hasModel]);

  return (
    <div className="preview-stage">
      <div className="canvas-container" ref={container} />
      {!hasModel ? (
        <div className="preview-overlay">
          <span className="preview-cube" aria-hidden="true">
            ◇
          </span>
          <h3>在这里查看你的模块</h3>
          <p>选择 GLB 文件后即可预览</p>
        </div>
      ) : status.phase !== "ready" ? (
        <div
          className="preview-overlay"
          role={status.phase === "error" ? "alert" : "status"}
        >
          <span
            className={
              status.phase === "loading" ? "loading-ring" : "preview-cube"
            }
            aria-hidden="true"
          >
            {status.phase === "error" ? "!" : ""}
          </span>
          <p>{status.message}</p>
        </div>
      ) : (
        <>
          <span className="preview-tag">
            3D PREVIEW <span>● 已加载</span>
          </span>
          <div className="preview-controls">
            <span>拖动旋转 · 滚轮缩放</span>
            <button
              type="button"
              className="button"
              onClick={() => resetView.current()}
            >
              重置视角
            </button>
          </div>
        </>
      )}
    </div>
  );
}
