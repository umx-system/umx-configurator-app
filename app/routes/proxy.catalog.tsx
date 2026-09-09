import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { catalog } from "../services/catalog-instance.server";
import { audienceFromTags } from "../services/catalog.server";
import { catalogError } from "../services/catalog-request.server";
import { DraftError } from "../services/model-upload.server";
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { admin, session } = await authenticate.public.appProxy(request);
    if (!session) throw new DraftError("应用未安装", 401);
    const q = new URL(request.url).searchParams;
    const scope =
      q.get("scope") === "inventory"
        ? "inventory"
        : q.get("scope") === "library"
          ? "library"
          : "base";
    if (
      !q.get("timestamp") ||
      !Number.isFinite(Number(q.get("timestamp"))) ||
      Math.abs(Date.now() / 1000 - Number(q.get("timestamp"))) > 300
    )
      throw new DraftError("请求已过期", 401);
    let audience: "consumer" | "business" | "internal" = "consumer";
    const customerId = q.get("logged_in_customer_id");
    if (scope !== "base" || customerId) {
      if (!customerId || !/^\d+$/.test(customerId) || !admin)
        throw new DraftError("请先登录", 401);
      const response = await admin.graphql(
        "query CatalogCustomer($id: ID!) { customer(id: $id) { tags } }",
        { variables: { id: `gid://shopify/Customer/${customerId}` } },
      );
      const body = (await response.json()) as {
        errors?: unknown;
        data?: { customer?: { tags?: string[] } };
      };
      if (body.errors || !Array.isArray(body.data?.customer?.tags))
        throw new DraftError("无法验证客户权限，请检查应用客户读取权限", 403);
      audience = audienceFromTags(body.data.customer.tags);
    }
    return Response.json(
      await catalog.deliver(
        session.shop,
        audience,
        process.env.SHOPIFY_APP_URL || request.url,
        scope,
      ),
      { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
    );
  } catch (error) {
    if (error instanceof Response) throw error;
    return catalogError(error);
  }
}
