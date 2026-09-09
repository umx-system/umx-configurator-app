import { validateBytes } from "gltf-validator";
import { MAX_REQUEST_BYTES } from "../lib/model-contract";
import { inspectGlb } from "../lib/glb";

export class DraftError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function readModelForm(request: Request): Promise<FormData> {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;"))
    throw new DraftError("请使用文件上传表单");
  const length = request.headers.get("content-length");
  if (length && Number(length) > MAX_REQUEST_BYTES)
    throw new DraftError("上传内容不能超过 25 MB", 413);
  if (!request.body) throw new DraftError("上传内容为空");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new DraftError("上传内容不能超过 25 MB", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = Buffer.concat(chunks, total);
  try {
    // Parsing is deliberately after the streaming cap, including chunked requests.
    return await new Response(buffer, {
      headers: { "content-type": request.headers.get("content-type")! },
    }).formData();
  } catch {
    throw new DraftError("上传表单无法解析，请重试");
  }
}

export async function validateGlb(bytes: Uint8Array) {
  try {
    inspectGlb(bytes);
  } catch (error) {
    throw new DraftError(
      error instanceof Error ? error.message : "GLB 文件无效",
    );
  }
  try {
    const report = await validateBytes(bytes, { maxIssues: 20 });
    if (report.issues.numErrors > 0)
      throw new DraftError("GLB 结构校验失败，请检查网格、贴图或重新导出文件");
  } catch (error) {
    if (error instanceof DraftError) throw error;
    throw new DraftError("GLB 结构无法解析，请重新导出文件");
  }
}
