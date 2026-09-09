import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { assets } from "../services/catalog-instance.server";
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const { asset, bytes } = await assets.read(session.shop, params.id!);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
