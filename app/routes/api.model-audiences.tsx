import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { saveModelAudiences } from "../services/model-audiences.server";
import {
  readCatalogJson,
  catalogError,
} from "../services/catalog-request.server";
import { DraftError } from "../services/model-upload.server";

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  try {
    if (request.method !== "POST") throw new DraftError("不支持的操作", 405);
    const result = await saveModelAudiences(
      db,
      session.shop,
      await readCatalogJson(request),
    );
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return catalogError(error);
  }
}
