import { MAX_GLB_BYTES } from "./model-contract";

// Shared preflight prevents the preview loader from fetching URLs inside a file.
// The server additionally runs the Khronos validator before persisting bytes.
export function inspectGlb(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_GLB_BYTES)
    throw new Error("GLB 文件不能超过 25 MB");
  if (bytes.byteLength < 20) throw new Error("文件不是有效的 GLB 模型");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2)
    throw new Error("仅支持 GLB 2.0 模型");
  if (view.getUint32(8, true) !== bytes.byteLength)
    throw new Error("GLB 文件不完整，请重新导出");
  const jsonLength = view.getUint32(12, true);
  if (
    view.getUint32(16, true) !== 0x4e4f534a ||
    jsonLength > 2 * 1024 * 1024 ||
    jsonLength % 4 ||
    20 + jsonLength > bytes.byteLength
  )
    throw new Error("GLB 描述数据无效或超过 2 MB");
  let document: Record<string, unknown>;
  try {
    document = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(20, 20 + jsonLength),
      ),
    );
  } catch {
    throw new Error("GLB 描述数据无法解析");
  }
  if (!document || typeof document !== "object" || Array.isArray(document))
    throw new Error("GLB 描述数据无效");
  let cursor = 20 + jsonLength;
  if (cursor < bytes.byteLength) {
    if (
      cursor + 8 > bytes.byteLength ||
      view.getUint32(cursor + 4, true) !== 0x004e4942
    )
      throw new Error("GLB 二进制数据无效");
    const binaryLength = view.getUint32(cursor, true);
    if (binaryLength % 4) throw new Error("GLB 数据未正确对齐");
    cursor += 8 + binaryLength;
  }
  if (cursor !== bytes.byteLength) throw new Error("GLB 数据长度无效");
  const stack: unknown[] = [document];
  while (stack.length) {
    const item = stack.pop();
    if (item && typeof item === "object") {
      for (const [key, value] of Object.entries(item)) {
        if (key === "uri")
          throw new Error("请导出自包含 GLB：贴图和缓冲数据必须嵌入文件");
        if (value && typeof value === "object") stack.push(value);
      }
    }
  }
  const meshes = document.meshes;
  if (!Array.isArray(meshes) || !meshes.length)
    throw new Error("GLB 中没有可预览的网格");
  if (
    meshes.length > 5000 ||
    (Array.isArray(document.nodes) && document.nodes.length > 10000)
  )
    throw new Error("模型对象过多，请简化后上传");
  const accessors = Array.isArray(document.accessors) ? document.accessors : [];
  const elements = accessors.reduce(
    (total, accessor) => total + (Number(accessor?.count) || 0),
    0,
  );
  if (elements > 30_000_000) throw new Error("模型网格数据过大，请简化后上传");
  const supported = new Set([
    "KHR_draco_mesh_compression",
    "KHR_materials_clearcoat",
    "KHR_materials_emissive_strength",
    "KHR_materials_ior",
    "KHR_materials_iridescence",
    "KHR_materials_sheen",
    "KHR_materials_specular",
    "KHR_materials_transmission",
    "KHR_materials_unlit",
    "KHR_materials_volume",
    "KHR_materials_anisotropy",
    "KHR_mesh_quantization",
    "KHR_texture_transform",
    "KHR_lights_punctual",
    "EXT_mesh_gpu_instancing",
    "EXT_texture_webp",
    "EXT_texture_avif",
  ]);
  if (Array.isArray(document.extensionsRequired)) {
    for (const extension of document.extensionsRequired) {
      if (!supported.has(extension))
        throw new Error(
          `暂不支持模型扩展 ${String(extension).slice(0, 80)}，请转换后上传`,
        );
    }
  }
  return document;
}
