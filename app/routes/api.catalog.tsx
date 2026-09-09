import type { LoaderFunctionArgs } from "react-router";
import { catalog } from "../services/catalog-instance.server";
import { catalogError } from "../services/catalog-request.server";
import { DraftError } from "../services/model-upload.server";
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const shop = new URL(request.url).searchParams.get("shop") || "";
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop))
      throw new DraftError("店铺无效", 400);
    return Response.json(await catalog.deliver(shop, "consumer", request.url), {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return catalogError(error, true);
  }
}
