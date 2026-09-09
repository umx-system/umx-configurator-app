import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { ModelMetadata } from "../lib/model-contract";
import { parseModelConfig } from "./catalog-schema.server";
import { DraftError, validateGlb } from "./model-upload.server";

export function createModelDraftService(db: PrismaClient, directory: string) {
  const root = path.resolve(directory);
  const filePath = (key: string) => {
    if (!/^[0-9a-f-]{36}\.glb$/.test(key))
      throw new DraftError("模型文件不可用", 404);
    return path.join(root, key);
  };
  const remove = async (key: string) => {
    try {
      await unlink(filePath(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  };
  const get = async (shop: string, id: string) => {
    const draft = await db.modelDraft.findFirst({ where: { id, shop } });
    if (!draft) throw new DraftError("未找到模型草稿", 404);
    return draft;
  };
  return {
    get,
    list: (shop: string, search = "", page = 1) => {
      const where = {
        shop,
        ...(search
          ? {
              OR: [
                { label: { contains: search } },
                { catalogCode: { contains: search } },
              ],
            }
          : {}),
      };
      return db.$transaction([
        db.modelDraft.findMany({
          where,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 30,
          skip: (page - 1) * 30,
        }),
        db.modelDraft.count({ where }),
      ]);
    },
    readFile: async (shop: string, id: string) => {
      const draft = await get(shop, id);
      try {
        return { bytes: await readFile(filePath(draft.fileKey)), draft };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          throw new DraftError("模型文件缺失，请重新上传并保存", 404);
        throw error;
      }
    },
    save: async (
      shop: string,
      metadata: ModelMetadata,
      identity: { id: string; revision: number } | null,
      upload: { bytes: Uint8Array; name: string } | null,
    ) => {
      const config = parseModelConfig(metadata.configJson);
      const assetIds = [config.thumbnailAssetId, config.thumbnailLightAssetId].filter(Boolean);
      if (assetIds.length && await db.catalogAsset.count({ where: { shop, id: { in: [...new Set(assetIds)] }, mimeType: { startsWith: "image/" } } }) !== new Set(assetIds).size)
        throw new DraftError("缩略图不存在或不属于当前店铺");
      const previous = identity ? await get(shop, identity.id) : null;
      if (previous && previous.revision !== identity?.revision)
        throw new DraftError(
          "这份草稿已被更新。请保留当前内容，重新打开最新草稿后再修改。",
          409,
        );
      if (!upload && !previous) throw new DraftError("请先选择 GLB 模型");
      let file = previous
        ? {
            fileKey: previous.fileKey,
            fileName: previous.fileName,
            fileSize: previous.fileSize,
            fileSha256: previous.fileSha256,
          }
        : null;
      let newKey: string | null = null;
      if (upload) {
        if (!/\.glb$/i.test(upload.name))
          throw new DraftError("请选择 .glb 文件");
        await validateGlb(upload.bytes);
        newKey = `${randomUUID()}.glb`;
        await mkdir(root, { recursive: true, mode: 0o700 });
        try {
          await writeFile(filePath(newKey), upload.bytes, {
            flag: "wx",
            mode: 0o600,
          });
        } catch (error) {
          await remove(newKey);
          throw error;
        }
        const fileName = Array.from(
          path.basename(upload.name.replaceAll("\\", "/")),
        )
          .filter(
            (char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127,
          )
          .join("")
          .slice(0, 180);
        file = {
          fileKey: newKey,
          fileName,
          fileSize: upload.bytes.byteLength,
          fileSha256: createHash("sha256").update(upload.bytes).digest("hex"),
        };
      }
      let saved;
      try {
        const data = {
          ...metadata,
          shortLabel: metadata.shortLabel || metadata.label.slice(0, 32),
          ...file!,
        };
        saved = await db.$transaction(async (tx) => {
          if (!identity)
            return tx.modelDraft.create({ data: { ...data, shop } });
          const result = await tx.modelDraft.updateMany({
            where: { id: identity.id, shop, revision: identity.revision },
            data: { ...data, revision: { increment: 1 } },
          });
          if (result.count !== 1)
            throw new DraftError(
              "这份草稿已被更新，请重新打开最新草稿后再修改。",
              409,
            );
          return tx.modelDraft.findFirstOrThrow({
            where: { id: identity.id, shop },
          });
        });
      } catch (error) {
        if (newKey) await remove(newKey);
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
          throw new DraftError("模块编码已存在，请换一个编码", 409);
        throw error;
      }
      if (newKey && previous && !await db.catalogRelease.count({ where: { shop, json: { contains: previous.fileKey } } })) {
        // A cleanup failure must not report a failed save after the DB committed.
        await remove(previous.fileKey).catch(() =>
          console.error("model_draft_old_file_cleanup_failed"),
        );
      }
      return saved;
    },
  };
}
