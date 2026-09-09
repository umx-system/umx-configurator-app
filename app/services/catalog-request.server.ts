import { DraftError } from "./model-upload.server";
export async function readCatalogJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new DraftError("请求格式错误", 415);
  if (!request.body) throw new DraftError("请求为空");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1024 * 1024) {
        await reader.cancel();
        throw new DraftError("目录设置最大 1 MB", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DraftError("目录设置格式无效");
  }
}
export function catalogError(error: unknown, cors = false) {
  return Response.json(
    {
      ok: false,
      message:
        error instanceof DraftError
          ? error.message
          : "目录暂时不可用，请稍后重试",
    },
    {
      status: error instanceof DraftError ? error.status : 500,
      headers: {
        "Cache-Control": "private, no-store",
        ...(cors ? { "Access-Control-Allow-Origin": "*" } : {}),
      },
    },
  );
}
