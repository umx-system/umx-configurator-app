import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { modelConfigSchema, parseModelConfig } from "./catalog-schema.server";
import { DraftError } from "./model-upload.server";

const inputSchema = z
  .object({
    id: z.string().uuid(),
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    audiences: modelConfigSchema.shape.audiences,
  })
  .strict();

export async function saveModelAudiences(
  db: PrismaClient,
  shop: string,
  input: unknown,
) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new DraftError("受众设置格式无效", 422);
  const { id, revision, audiences } = parsed.data;
  const draft = await db.modelDraft.findFirst({ where: { id, shop } });
  if (!draft) throw new DraftError("未找到模型草稿", 404);
  if (draft.revision !== revision)
    throw new DraftError("模型已被更新，请刷新页面后重试", 409);
  const config = parseModelConfig(draft.configJson);
  const updatedAt = new Date();
  const result = await db.modelDraft.updateMany({
    where: { id, shop, revision },
    data: {
      configJson: JSON.stringify({ ...config, audiences }),
      revision: { increment: 1 },
      updatedAt,
    },
  });
  if (result.count !== 1)
    throw new DraftError("模型已被更新，请刷新页面后重试", 409);
  return {
    ok: true as const,
    id,
    revision: revision + 1,
    audiences,
    updatedAt,
  };
}
