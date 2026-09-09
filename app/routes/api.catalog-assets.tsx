import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { assets } from "../services/catalog-instance.server";
import { readModelForm, DraftError } from "../services/model-upload.server";
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  try {
    if (request.method !== "POST") throw new DraftError("不支持的操作", 405);
    const form = await readModelForm(request);
    const file = form.get("file");
    if (!file || typeof file === "string")
      throw new DraftError("请选择图片或 HDR 文件");
    const asset = await assets.save(
      session.shop,
      file.name,
      new Uint8Array(await file.arrayBuffer()),
    );
    return Response.json(
      {
        ok: true,
        asset: { id: asset.id, name: asset.name, mimeType: asset.mimeType },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: error instanceof DraftError ? error.message : "上传失败",
      },
      { status: error instanceof DraftError ? error.status : 500 },
    );
  }
}
