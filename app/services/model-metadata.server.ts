import { z } from "zod";

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
