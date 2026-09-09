import type { LoaderFunctionArgs } from "react-router";
import { catalog } from "../services/catalog-instance.server";
import { catalogError } from "../services/catalog-request.server";
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { bytes, mimeType } = await catalog.readAsset(new URL(request.url));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mimeType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return catalogError(error, true);
  }
}
