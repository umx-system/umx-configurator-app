import { access, constants } from "node:fs/promises";
import db from "../db.server";

export async function loader() {
  try {
    await db.$queryRaw`SELECT 1`;
    await Promise.all([
      access(
        process.env.MODEL_STORAGE_DIR || "./data/models",
        constants.R_OK | constants.W_OK,
      ),
      access(
        process.env.CATALOG_ASSET_DIR || "./data/catalog-assets",
        constants.R_OK | constants.W_OK,
      ),
    ]);
    return Response.json(
      { status: "ok" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
