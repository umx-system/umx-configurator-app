import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ModelDraft, PrismaClient } from "@prisma/client";
import {
  parseModelConfig,
  settingsSchema,
  type ModelConfig,
  type CatalogSettingsData,
} from "./catalog-schema.server";
import { DraftError } from "./model-upload.server";
export type Audience = "consumer" | "business" | "internal";
type PublishedModel = ModelDraft & { config: ModelConfig };
export type ReleaseData = {
  models: PublishedModel[];
  settings: CatalogSettingsData;
};
export const audienceFromTags = (tags: string[]): Audience =>
  tags.includes("nb")
    ? "internal"
    : tags.includes("tob")
      ? "business"
      : "consumer";
export function catalogFingerprint(
  models: Pick<ModelDraft, "id" | "revision">[],
  settingsRevision: number,
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        models: models.map((m) => [m.id, m.revision]).sort(),
        settingsRevision,
      }),
    )
    .digest("hex");
}
export function assetSignature(
  secret: string,
  shop: string,
  releaseId: string,
  modelId: string,
  part: string,
  expires: number,
) {
  return createHmac("sha256", secret)
    .update(JSON.stringify([shop, releaseId, modelId, part, expires]))
    .digest("hex");
}
export function validAssetSignature(
  secret: string,
  url: URL,
  now = Date.now(),
) {
  const q = url.searchParams;
  const expires = Number(q.get("expires"));
  const signature = q.get("signature") || "";
  if (
    !Number.isSafeInteger(expires) ||
    expires < now / 1000 ||
    expires > now / 1000 + 21601 ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const expected = assetSignature(
    secret,
    q.get("shop") || "",
    q.get("release") || "",
    q.get("model") || "",
    q.get("part") || "",
    expires,
  );
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
export function validateRelease(
  models: PublishedModel[],
  settings: CatalogSettingsData,
) {
  if (!models.length) throw new DraftError("请先添加模型");
  const ids = new Set<string>();
  const slots = new Set<string>();
  for (const model of models) {
    if (!model.modelId || ids.has(model.modelId))
      throw new DraftError("每个模型必须有唯一且稳定的模型编号");
    ids.add(model.modelId);
    if (model.config.enabled && model.config.slot) {
      if (slots.has(model.config.slot))
        throw new DraftError("配件用途或独立产品入口重复");
      slots.add(model.config.slot);
    }
    if (model.config.kind === "module" && model.config.slot)
      throw new DraftError("模块不能占用配件或产品用途");
    if (
      model.config.kind === "accessory" &&
      !["outer", "center", "baseRod", "caster", "footSupport"].includes(
        model.config.slot,
      )
    )
      throw new DraftError("请选择配件用途");
    if (model.config.kind === "product" && model.config.slot !== "chair")
      throw new DraftError("请选择独立产品入口");
  }
  for (const slot of ["outer", "center", "baseRod", "caster", "footSupport"]) {
    const accessory = models.find(
      (m) => m.config.enabled && m.config.slot === slot,
    );
    if (
      !accessory ||
      !["consumer", "business", "internal"].every((a) =>
        accessory.config.audiences.includes(a as Audience),
      )
    )
      throw new DraftError(`基础配件 ${slot} 必须对全部用户可用`);
    if (
      ["outer", "center", "baseRod", "caster"].includes(slot) &&
      Object.values(accessory.config.prices).some((p) => p === null)
    )
      throw new DraftError(`基础配件 ${slot} 需要各渠道预估价格`);
  }
  for (const model of models.filter((m) => m.config.enabled)) {
    let donor = model;
    const visited = new Set<string>([model.modelId!]);
    while (donor.config.render.dividerSourceId) {
      const source = models.find(
        (m) =>
          m.modelId === donor.config.render.dividerSourceId &&
          m.config.enabled &&
          m.config.render.dividerDonor,
      );
      if (
        !source ||
        visited.has(source.modelId!) ||
        !model.config.audiences.every((a) =>
          source.config.audiences.includes(a),
        )
      )
        throw new DraftError("隔板来源不存在、循环引用或可见范围不匹配");
      visited.add(source.modelId!);
      donor = source;
    }
  }
  const checkLayout = (modules: { moduleId: string }[]) => {
    if (
      modules.some(
        (m) =>
          !models.some(
            (d) =>
              d.modelId === m.moduleId &&
              d.config.kind === "module" &&
              d.config.enabled,
          ),
      )
    )
      throw new DraftError("组合引用了不存在或已停用的模块");
  };
  if (
    !settings.presets.length ||
    !settings.presets.some((p) => p.id === settings.defaultPresetId)
  )
    throw new DraftError("请选择有效的默认组合");
  if (
    !settings.woodColors[settings.defaultWoodColor] ||
    !settings.connectorColors[settings.defaultConnectorColor]
  )
    throw new DraftError("默认配色必须存在于配色列表");
  const defaultPreset = settings.presets.find(
    (p) => p.id === settings.defaultPresetId,
  )!;
  if (
    defaultPreset.modules.some(
      (p) =>
        !["consumer", "business", "internal"].every((a) =>
          models
            .find((m) => m.modelId === p.moduleId)
            ?.config.audiences.includes(a as Audience),
        ),
    )
  )
    throw new DraftError("默认组合必须对全部用户可用");
  settings.presets.forEach((p) => checkLayout(p.modules));
  Object.values(settings.bundleSettings.EXTRA_BUNDLE_LAYOUTS).forEach(
    checkLayout,
  );
  if (
    new Set(settings.presets.map((p) => p.id)).size !== settings.presets.length
  )
    throw new DraftError("组合编号不能重复");
  if (
    settings.materials.boardMinThicknessM >=
    settings.materials.boardMaxThicknessM
  )
    throw new DraftError("面板厚度最小值必须小于最大值");
  for (const axis of ["x", "y", "z"] as const)
    if (
      settings.materials.dividerMinM[axis] >
      settings.materials.dividerMaxM[axis]
    )
      throw new DraftError("隔板范围最小值不能大于最大值");
}
export function createCatalogService(
  db: PrismaClient,
  modelDirectory: string,
  assetDirectory: string,
  secret: string,
) {
  const readRelease = async (shop: string) => {
    const publication = await db.catalogPublication.findUnique({
      where: { shop },
    });
    if (!publication) throw new DraftError("目录尚未发布", 503);
    const release = await db.catalogRelease.findFirst({
      where: { id: publication.releaseId, shop },
    });
    if (!release) throw new DraftError("发布目录不可用", 503);
    return { release, payload: JSON.parse(release.json) as ReleaseData };
  };
  return {
    readRelease,
    async publish(shop: string, expectedFingerprint: string) {
      return db.$transaction(
        async (tx) => {
          const models = await tx.modelDraft.findMany({ where: { shop } });
          const settings = await tx.catalogSettings.findUnique({
            where: { shop },
          });
          if (!settings) throw new DraftError("请先保存目录设置");
          if (
            catalogFingerprint(models, settings.revision) !==
            expectedFingerprint
          )
            throw new DraftError("目录已更新，请刷新后重新预览和发布", 409);
          const payload: ReleaseData = {
            models: models.map((m) => ({
              ...m,
              config: parseModelConfig(m.configJson),
            })),
            settings: settingsSchema.parse(JSON.parse(settings.json)),
          };
          validateRelease(payload.models, payload.settings);
          const assetIds = [
            payload.settings.environmentAssetId,
            ...payload.settings.presets.map((p) => p.previewAssetId),
            ...payload.models.flatMap((m) => [
              m.config.thumbnailAssetId,
              m.config.thumbnailLightAssetId,
            ]),
          ].filter(Boolean);
          const assets = await tx.catalogAsset.findMany({
            where: { shop, id: { in: [...new Set(assetIds)] } },
          });
          if (assets.length !== new Set(assetIds).size)
            throw new DraftError("目录引用的图片或环境资源不存在");
          // Check actual bytes, not only database rows, before making a release visible.
          for (const model of payload.models) {
            const bytes = await readFile(
              path.join(modelDirectory, model.fileKey),
            );
            if (
              createHash("sha256").update(bytes).digest("hex") !==
              model.fileSha256
            )
              throw new DraftError("模型文件校验失败");
          }
          for (const asset of assets) {
            const bytes = await readFile(
              path.join(assetDirectory, asset.fileKey),
            );
            if (
              createHash("sha256").update(bytes).digest("hex") !== asset.sha256
            )
              throw new DraftError("图片或环境文件校验失败");
          }
          const release = await tx.catalogRelease.create({
            data: { shop, json: JSON.stringify(payload) },
          });
          await tx.catalogPublication.upsert({
            where: { shop },
            create: { shop, releaseId: release.id },
            update: { releaseId: release.id },
          });
          return release;
        },
        { timeout: 30000 },
      );
    },
    async rollback(shop: string, releaseId: string) {
      const release = await db.catalogRelease.findFirst({
        where: { shop, id: releaseId },
      });
      if (!release) throw new DraftError("版本不存在", 404);
      const payload = JSON.parse(release.json) as ReleaseData;
      const parsedSettings = settingsSchema.safeParse(payload.settings);
      if (!parsedSettings.success)
        throw new DraftError("此旧版本的数据结构不兼容，无法恢复", 409);
      validateRelease(
        payload.models.map((m) => ({
          ...m,
          config: parseModelConfig(m.configJson),
        })),
        parsedSettings.data,
      );
      return db.catalogPublication.upsert({
        where: { shop },
        create: { shop, releaseId },
        update: { releaseId },
      });
    },
    async deliver(
      shop: string,
      audience: Audience,
      baseUrl: string,
      scope: "base" | "library" | "inventory" = "base",
    ) {
      const { release, payload } = await readRelease(shop);
      if (scope === "inventory") {
        if (audience !== "internal")
          throw new DraftError("无权查看内部资料", 403);
        return {
          schemaVersion: 1,
          revision: release.id,
          inventory: payload.settings.inventory,
        };
      }
      // Bootstrap uses authorized channel prices, with public model definitions only.
      const effective = audience;
      const expires = Math.floor(Date.now() / 1000) + 21600;
      const assetUrl = (modelId: string, part: string) => {
        const url = new URL("/api/catalog-asset", baseUrl);
        url.search = new URLSearchParams({
          shop,
          release: release.id,
          model: modelId,
          part,
          expires: String(expires),
          signature: assetSignature(
            secret,
            shop,
            release.id,
            modelId,
            part,
            expires,
          ),
        }).toString();
        return url.href;
      };
      const selected = payload.models
        .filter(
          (m) =>
            m.config.enabled &&
            m.config.audiences.includes(effective) &&
            (scope !== "base" || m.config.audiences.includes("consumer")),
        )
        .sort((a, b) => a.config.sortOrder - b.config.sortOrder);
      const ids = new Set(selected.map((m) => m.modelId));
      const models = selected.map((m) => ({
        id: m.modelId!,
        label: m.label,
        shortLabel: m.shortLabel,
        catalogCode: m.catalogCode || "",
        catalogName: m.config.catalogName,
        category: m.config.category,
        kind: m.config.kind,
        slot: m.config.slot,
        model: assetUrl(m.modelId!, "glb"),
        thumbnail: m.config.thumbnailAssetId
          ? assetUrl(m.modelId!, "thumbnail")
          : "",
        thumbnailLight: m.config.thumbnailLightAssetId
          ? assetUrl(m.modelId!, "thumbnailLight")
          : "",
        widthMm: m.widthMm,
        depthMm: m.depthMm,
        heightMm: m.heightMm,
        frontWidthMm: m.frontWidthMm ?? undefined,
        gridWidth: m.gridWidth,
        gridHeight: m.gridHeight,
        placement: m.placement,
        placementYOffsetMm: m.placementYOffsetMm,
        supportsMarineBoardColor: m.supportsMarineBoardColor,
        previewTransform: m.previewTransform,
        note: m.note,
        unitPrice: m.config.prices[effective],
        localizedCopy: m.config.localizedCopy,
        motion: m.config.motion,
        render: m.config.render,
        commerce: m.config.commerce,
      }));
      const {
        inventory: _inventory,
        environmentAssetId,
        presets,
        ...settings
      } = payload.settings;
      void _inventory;
      // Settings contain no channel pricing or private BOM; remove layouts that reference hidden models.
      const extra = Object.fromEntries(
        Object.entries(settings.bundleSettings.EXTRA_BUNDLE_LAYOUTS).filter(
          ([, layout]) => layout.every((m) => ids.has(m.moduleId)),
        ),
      );
      const visiblePresets = presets.filter((p) =>
        p.modules.every((m) => ids.has(m.moduleId)),
      );
      const sources = new Set([
        ...visiblePresets.map((p) => p.id),
        ...Object.keys(extra),
      ]);
      return {
        schemaVersion: 1,
        revision: release.id,
        audience: effective,
        models,
        settings: {
          ...settings,
          environment: assetUrl("", `asset:${environmentAssetId}`),
          presets: visiblePresets.map(({ previewAssetId, ...p }) => ({
            ...p,
            previewImage: assetUrl("", `asset:${previewAssetId}`),
          })),
          bundles: {
            ...settings.bundles,
            bundles: settings.bundles.bundles.filter((b) =>
              sources.has(b.source),
            ),
          },
          bundleSettings: {
            ...settings.bundleSettings,
            EXTRA_BUNDLE_LAYOUTS: extra,
          },
        },
      };
    },
    async readAsset(url: URL) {
      if (!validAssetSignature(secret, url))
        throw new DraftError("资源链接已过期，请刷新配置器", 403);
      const q = url.searchParams;
      const shop = q.get("shop")!;
      const { release, payload } = await readRelease(shop);
      if (release.id !== q.get("release"))
        throw new DraftError("目录已更新，请刷新配置器", 409);
      const model = payload.models.find(
        (m) => m.modelId === q.get("model") && m.config.enabled,
      );
      const part = q.get("part")!;
      if (model && part === "glb")
        return {
          bytes: await readFile(path.join(modelDirectory, model.fileKey)),
          mimeType: "model/gltf-binary",
        };
      let assetId = model
        ? part === "thumbnail"
          ? model.config.thumbnailAssetId
          : part === "thumbnailLight"
            ? model.config.thumbnailLightAssetId
            : ""
        : "";
      if (!model && part.startsWith("asset:")) {
        const requested = part.slice(6);
        if (
          [
            payload.settings.environmentAssetId,
            ...payload.settings.presets.map((p) => p.previewAssetId),
          ].includes(requested)
        )
          assetId = requested;
      }
      const asset = assetId
        ? await db.catalogAsset.findFirst({ where: { id: assetId, shop } })
        : null;
      if (!asset) throw new DraftError("资源不存在", 404);
      return {
        bytes: await readFile(path.join(assetDirectory, asset.fileKey)),
        mimeType: asset.mimeType,
      };
    },
  };
}
