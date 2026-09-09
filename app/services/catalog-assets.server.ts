import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { DraftError } from "./model-upload.server";

export function createAssetService(db: PrismaClient, directory: string) {
  const filePath = (key: string) => {
    if (!/^[0-9a-f-]{36}\.asset$/.test(key))
      throw new DraftError("文件不可用", 404);
    return path.join(directory, key);
  };
  return {
    async save(shop: string, name: string, bytes: Uint8Array) {
      if (!bytes.length || bytes.length > 20 * 1024 * 1024)
        throw new DraftError("图片 / 环境文件最大 20 MB");
      const b = Buffer.from(bytes);
      let mimeType = "";
      if (
        b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        mimeType = "image/png";
      else if (b[0] === 255 && b[1] === 216 && b[2] === 255)
        mimeType = "image/jpeg";
      else if (
        b.toString("ascii", 0, 4) === "RIFF" &&
        b.toString("ascii", 8, 12) === "WEBP"
      )
        mimeType = "image/webp";
      else if (
        b.toString("ascii", 0, 10) === "#?RADIANCE" ||
        b.toString("ascii", 0, 6) === "#?RGBE"
      )
        mimeType = "image/vnd.radiance";
      if (!mimeType)
        throw new DraftError("仅支持 PNG、JPEG、WebP 图片和 HDR 环境文件");
      const fileKey = `${randomUUID()}.asset`;
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(filePath(fileKey), bytes, { flag: "wx", mode: 0o600 });
      try {
        return await db.catalogAsset.create({
          data: {
            shop,
            name: path.basename(name).slice(0, 180),
            mimeType,
            fileKey,
            size: bytes.length,
            sha256,
          },
        });
      } catch (error) {
        await unlink(filePath(fileKey));
        throw error;
      }
    },
    async read(shop: string, id: string) {
      const asset = await db.catalogAsset.findFirst({ where: { id, shop } });
      if (!asset) throw new DraftError("资源不存在", 404);
      return { asset, bytes: await readFile(filePath(asset.fileKey)) };
    },
  };
}
