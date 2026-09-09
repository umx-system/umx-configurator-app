import { z } from "zod";
import { parseModelConfig } from "./catalog-schema.server";

const numberField = (min: number, max: number, integer = false) =>
  z
    .string()
    .trim()
    .min(1, "请填写数值")
    .transform(Number)
    .pipe(
      integer
        ? z
            .number()
            .int("请输入整数")
            .min(min, `不能小于 ${min}`)
            .max(max, `不能大于 ${max}`)
        : z.number().min(min, `不能小于 ${min}`).max(max, `不能大于 ${max}`),
    );

export const modelMetadataSchema = z.object({
  modelId: z.string().trim().regex(/^[A-Za-z0-9_-]{0,80}$/, "模型编号只允许字母、数字、下划线和短横线").transform(v => v || null),
  configJson: z.string().max(48000).transform((value, ctx) => {
    try { return JSON.stringify(parseModelConfig(value)); }
    catch (error) { ctx.addIssue({ code: "custom", message: error instanceof z.ZodError ? error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("；") : "模型设置格式无效" }); return z.NEVER; }
  }),
  label: z
    .string()
    .trim()
    .min(1, "请填写模块名称")
    .max(120, "名称不能超过 120 个字符"),
  shortLabel: z.string().trim().max(32, "简称不能超过 32 个字符"),
  catalogCode: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z0-9_-]*$/, "编码仅支持英文、数字、下划线和短横线")
    .transform((value) => value.toUpperCase() || null),
  note: z.string().trim().max(2000, "备注不能超过 2000 个字符"),
  widthMm: numberField(0.0001, 10000),
  depthMm: numberField(0.0001, 10000),
  heightMm: numberField(0.0001, 10000),
  frontWidthMm: z.union([
    z.literal("").transform(() => null),
    numberField(0.0001, 10000),
  ]),
  gridWidth: numberField(1, 24, true),
  gridHeight: numberField(1, 24, true),
  placement: z.enum(["grid", "top"]),
  placementYOffsetMm: numberField(-10000, 10000),
  supportsMarineBoardColor: z
    .enum(["true", "false"])
    .transform((value) => value === "true"),
  previewTransform: z.enum(["scene", "rhino"]),
});
