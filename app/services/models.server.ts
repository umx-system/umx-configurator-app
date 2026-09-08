import db from "../db.server";
import { createModelDraftService } from "./model-drafts.server";

export const models = createModelDraftService(
  db,
  process.env.MODEL_STORAGE_DIR || "./data/models",
);
