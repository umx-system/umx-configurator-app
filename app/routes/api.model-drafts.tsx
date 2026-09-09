import { modelMetadataSchema } from "../services/model-metadata.server";
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import type { SaveResult } from "../lib/model-contract";
import { readModelForm, DraftError } from "../services/model-upload.server";
import { models } from "../services/models.server";

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const respond = (body: SaveResult, status = 200) =>
    Response.json(body, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  if (request.method !== "POST")
    return respond({ ok: false, message: "请求方式不支持" }, 405);
  try {
    const form = await readModelForm(request);
    for (const key of form.keys()) {
      if (form.getAll(key).length !== 1)
        throw new DraftError("表单字段重复，请重试");
    }
    const metadata = modelMetadataSchema.safeParse(Object.fromEntries(form));
    if (!metadata.success)
      return respond(
        {
          ok: false,
          message: "请检查模块参数",
          errors: metadata.error.flatten().fieldErrors,
        },
        422,
      );
    const rawId = form.get("id");
    const revision = Number(form.get("revision"));
    if (
      rawId &&
      (typeof rawId !== "string" ||
        rawId.length > 64 ||
        !Number.isSafeInteger(revision) ||
        revision < 1)
    )
      throw new DraftError("草稿版本无效，请重新打开");
    const file = form.get("file");
    if (typeof file === "string") throw new DraftError("请选择 GLB 文件");
    const saved = await models.save(
      session.shop,
      metadata.data,
      rawId ? { id: rawId as string, revision } : null,
      file && file.size
        ? { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name }
        : null,
    );
    return respond({ ok: true, id: saved.id, revision: saved.revision });
  } catch (error) {
    if (error instanceof DraftError)
      return respond({ ok: false, message: error.message }, error.status);
    console.error("model_draft_save_failed");
    return respond(
      { ok: false, message: "保存失败，当前填写内容已保留，请稍后重试" },
      500,
    );
  }
}
