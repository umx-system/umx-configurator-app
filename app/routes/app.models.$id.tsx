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

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  if (params.id === "new")
    return data(
      { draft: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  try {
    return data(
      { draft: await models.get(session.shop, params.id!) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof DraftError)
      throw new Response(error.message, { status: error.status });
    throw error;
  }
}

export default function ModelEditorRoute() {
  const { draft } = useLoaderData<typeof loader>();
  return (
    <ModelEditor
      key={draft ? `${draft.id}-${draft.revision}` : "new"}
      draft={draft}
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
