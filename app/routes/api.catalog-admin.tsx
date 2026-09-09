import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { catalog } from "../services/catalog-instance.server";
import { settingsSchema } from "../services/catalog-schema.server";
import {
  readCatalogJson,
  catalogError,
} from "../services/catalog-request.server";
import { DraftError } from "../services/model-upload.server";
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  try {
    if (request.method !== "POST") throw new DraftError("不支持的操作", 405);
    const body = await readCatalogJson(request);
    if (body.operation === "save") {
      const parsed = settingsSchema.safeParse(body.settings);
      if (!parsed.success)
        throw new DraftError(
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("；"),
          422,
        );
      const result = await db.catalogSettings.updateMany({
        where: { shop: session.shop, revision: body.revision },
        data: { json: JSON.stringify(parsed.data), revision: { increment: 1 } },
      });
      if (result.count !== 1)
        throw new DraftError("设置已更新，请刷新后重新编辑", 409);
    } else if (body.operation === "publish") {
      await catalog.publish(session.shop, String(body.fingerprint));
    } else if (body.operation === "rollback") {
      await catalog.rollback(session.shop, String(body.releaseId));
    } else throw new DraftError("未知操作");
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return catalogError(error);
  }
}
