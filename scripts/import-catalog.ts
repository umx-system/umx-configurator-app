import { isDeepStrictEqual } from "node:util";
// Input and model assets must stay outside Git. This tool never stores credentials.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { createAssetService } from "../app/services/catalog-assets.server";
import { createModelDraftService } from "../app/services/model-drafts.server";
import { modelMetadataSchema } from "../app/services/model-metadata.server";
import {
  settingsSchema,
  modelConfigSchema,
} from "../app/services/catalog-schema.server";
import { validateGlb } from "../app/services/model-upload.server";
import { emptyModelForm } from "../app/lib/model-contract";
const [manifestPath, assetRoot, shop] = process.argv.slice(2);
if (
  !manifestPath ||
  !assetRoot ||
  !shop ||
  !/^[a-z0-9-]+\.myshopify\.com$/.test(shop)
)
  throw new Error(
    "用法：node --env-file=.env --import tsx scripts/import-catalog.ts 私有清单.json 资源目录 shop.myshopify.com",
  );
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const db = new PrismaClient();
const assetService = createAssetService(
  db,
  process.env.CATALOG_ASSET_DIR || "./data/catalog-assets",
);
const models = createModelDraftService(
  db,
  process.env.MODEL_STORAGE_DIR || "./data/models",
);
const sourceFile = (name: string) => {
  const resolved = path.resolve(assetRoot, name);
  if (!resolved.startsWith(path.resolve(assetRoot) + path.sep))
    throw new Error("资源必须位于指定目录");
  return resolved;
};
const importedAssets = new Map<string, string>();
async function asset(name: string) {
  if (!name) return "";
  if (importedAssets.has(name)) return importedAssets.get(name)!;
  const bytes = await readFile(sourceFile(name));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const existing = await db.catalogAsset.findFirst({ where: { shop, sha256 } });
  const saved = existing || (await assetService.save(shop, name, bytes));
  importedAssets.set(name, saved.id);
  return saved.id;
}
const report: { id: string; bytes: number; sha256: string; result: string }[] =
  [];
try {
  // Validate all metadata and all files before changing any model records.
  const ready = [];
  for (const item of manifest.models) {
    const bytes = await readFile(sourceFile(item.file));
    await validateGlb(bytes);
    const config = {
      ...item.config,
      thumbnailAssetId: await asset(item.thumbnail || ""),
      thumbnailLightAssetId: await asset(item.thumbnailLight || ""),
    };
    modelConfigSchema.parse(config);
    const form = Object.fromEntries(
      Object.entries({
        ...emptyModelForm,
        ...item.metadata,
        configJson: JSON.stringify(config),
      }).map(([k, v]) => [k, v === null ? "" : String(v)]),
    );
    const metadata = modelMetadataSchema.parse(form);
    metadata.shortLabel ||= metadata.label.slice(0, 32);
    ready.push({
      metadata,
      bytes,
      name: item.file,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const settings = {
    ...manifest.settings,
    environmentAssetId: await asset(manifest.environment),
    presets: await Promise.all(
      manifest.settings.presets.map(async (p: { previewFile: string }) => {
        const { previewFile, ...rest } = p;
        return { ...rest, previewAssetId: await asset(previewFile) };
      }),
    ),
  };
  settingsSchema.parse(settings);
  for (const item of ready) {
    let existing = await db.modelDraft.findFirst({
      where: { shop, modelId: item.metadata.modelId },
    });
    if (!existing) {
      const candidates = await db.modelDraft.findMany({
        where: { shop, modelId: null, fileSha256: item.sha256 },
      });
      if (candidates.length === 1) existing = candidates[0];
    }
    if (existing?.modelId) {
      if (
        existing.fileSha256 !== item.sha256 ||
        Object.entries(item.metadata).some(([k, v]) =>
          k === "configJson"
            ? !isDeepStrictEqual(
                JSON.parse(existing!.configJson),
                JSON.parse(String(v)),
              )
            : typeof v === "number" &&
                typeof existing![k as keyof typeof existing] === "number"
              ? Math.abs(Number(existing![k as keyof typeof existing]) - v) >
                Number.EPSILON * Math.max(1, Math.abs(v)) * 4
              : existing![k as keyof typeof existing] !== v,
        )
      )
        throw new Error(
          `已存在且有修改的模型 ${item.metadata.modelId}，停止覆盖`,
        );
      const stored = await models.readFile(shop, existing.id);
      if (
        createHash("sha256").update(stored.bytes).digest("hex") !== item.sha256
      )
        throw new Error("已存模型文件校验失败");
      report.push({
        id: existing.modelId,
        bytes: existing.fileSize,
        sha256: existing.fileSha256,
        result: "unchanged",
      });
      continue;
    }
    const saved = await models.save(
      shop,
      item.metadata,
      existing ? { id: existing.id, revision: existing.revision } : null,
      existing?.fileSha256 === item.sha256
        ? null
        : { bytes: item.bytes, name: item.name },
    );
    const stored = await models.readFile(shop, saved.id);
    if (createHash("sha256").update(stored.bytes).digest("hex") !== item.sha256)
      throw new Error("文件校验值不一致");
    report.push({
      id: saved.modelId!,
      bytes: saved.fileSize,
      sha256: saved.fileSha256,
      result: existing ? "adopted" : "created",
    });
  }
  const oldSettings = await db.catalogSettings.findUnique({ where: { shop } });
  if (oldSettings && !isDeepStrictEqual(JSON.parse(oldSettings.json), settings))
    throw new Error("现有目录设置与导入内容不同，停止覆盖");
  if (!oldSettings)
    await db.catalogSettings.create({
      data: { shop, json: JSON.stringify(settings) },
    });
  const reportPath = path.join(
    path.dirname(manifestPath),
    "migration-report.json",
  );
  await writeFile(
    reportPath,
    JSON.stringify(
      { models: report, assets: importedAssets.size, settings: true },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      models: report.length,
      assets: importedAssets.size,
      verifiedHashes: report.length,
      report: reportPath,
    }),
  );
} finally {
  await db.$disconnect();
}
