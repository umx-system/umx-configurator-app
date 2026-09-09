import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
  Link,
  data,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { models } from "../services/models.server";
import { DraftError } from "../services/model-upload.server";
import { ModelEditor } from "../components/ModelEditor";
import "../styles/models.css";
import db from "../db.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const assets = await db.catalogAsset.findMany({ where: { shop: session.shop }, select: { id: true, name: true, mimeType: true }, orderBy: { createdAt: "desc" } });
  if (params.id === "new")
    return data(
      { draft: null, assets },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  try {
    return data(
      { draft: await models.get(session.shop, params.id!), assets },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof DraftError)
      throw new Response(error.message, { status: error.status });
    throw error;
  }
}

export default function ModelEditorRoute() {
  const { draft, assets } = useLoaderData<typeof loader>();
  return (
    <ModelEditor
      key={draft ? `${draft.id}-${draft.revision}` : "new"}
      draft={draft}
      initialAssets={assets}
    />
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404)
    return (
      <main className="model-app">
        <h1>未找到模型草稿</h1>
        <p>这份草稿不存在，或不属于当前店铺。</p>
        <Link className="button" to="/app">
          返回模型管理
        </Link>
      </main>
    );
  return boundary.error(error);
}
export const headers: HeadersFunction = (args) => {
  const headers = new Headers(boundary.headers(args));
  headers.set("Cache-Control", "private, no-store");
  return headers;
};
