import db from "../db.server";
import { createCatalogService } from "./catalog.server";
import { createAssetService } from "./catalog-assets.server";
export const assetDirectory =
  process.env.CATALOG_ASSET_DIR || "./data/catalog-assets";
export const assets = createAssetService(db, assetDirectory);
export const catalog = createCatalogService(
  db,
  process.env.MODEL_STORAGE_DIR || "./data/models",
  assetDirectory,
  process.env.SHOPIFY_API_SECRET || "",
);
