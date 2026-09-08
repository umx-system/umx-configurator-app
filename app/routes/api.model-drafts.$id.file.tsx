import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { models } from "../services/models.server";
import { DraftError } from "../services/model-upload.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    const { bytes } = await models.readFile(session.shop, params.id!);
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        "Content-Type": "model/gltf-binary",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": 'inline; filename="model.glb"',
      },
    });
  } catch (error) {
    if (error instanceof DraftError)
      return new Response(error.message, { status: error.status, headers });
    console.error("model_draft_file_read_failed");
    return new Response("模型读取失败，请稍后重试", { status: 500, headers });
  }
}
