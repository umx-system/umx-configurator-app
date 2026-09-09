import { z } from "zod";

const text = z.string().max(2000);
const id = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const number = z.number().finite();
const mm = number.min(-10000).max(10000);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const xyz = z.object({ x: mm, y: mm, z: mm }).strict();
export const audienceSchema = z.enum(["consumer", "business", "internal"]);
export const modelConfigSchema = z
  .object({
    kind: z.enum(["module", "accessory", "product"]),
    slot: z.enum([
      "",
      "outer",
      "center",
      "baseRod",
      "caster",
      "footSupport",
      "chair",
    ]),
    enabled: z.boolean(),
    catalogName: text,
    category: z.string().min(1).max(80),
    sortOrder: number.int().min(0).max(100000),
    audiences: z
      .array(audienceSchema)
      .max(3)
      .refine((v) => new Set(v).size === v.length),
    prices: z
      .object({
        consumer: number.min(0).max(10000000).nullable(),
        business: number.min(0).max(10000000).nullable(),
        internal: number.min(0).max(10000000).nullable(),
      })
      .strict(),
    thumbnailAssetId: z.string().uuid().or(z.literal("")),
    thumbnailLightAssetId: z.string().uuid().or(z.literal("")),
    localizedCopy: z
      .object(
        Object.fromEntries(
          ["en", "ja", "ko"].map((locale) => [
            locale,
            z
              .object({
                label: text,
                shortLabel: text,
                catalogName: text,
                note: text,
              })
              .strict(),
          ]),
        ) as Record<
          "en" | "ja" | "ko",
          z.ZodObject<{
            label: typeof text;
            shortLabel: typeof text;
            catalogName: typeof text;
            note: typeof text;
          }>
        >,
      )
      .strict(),
    motion: z
      .object({
        kind: z.enum(["none", "translate-z", "rotate-x"]),
        distanceMm: mm,
        angleDeg: number.min(-180).max(180),
        pivotMm: xyz,
        openDurationMs: number.int().min(1).max(10000),
        closeDurationMs: number.int().min(1).max(10000),
        fallbackFrontPanel: z.boolean(),
        nodePrefix: z.string().min(1).max(100),
      })
      .strict(),
    render: z
      .object({
        blocksStackingAbove: z.boolean(),
        linework: z.enum([
          "open",
          "drawer",
          "drop-front",
          "cat-house",
          "aquarium",
          "speaker",
          "top-panel",
          "generic",
        ]),
        lineworkUseFullWidth: z.boolean(),
        dividerPositionsMm: z.array(number.min(0).max(10000)).max(20),
        dividerReferenceWidthMm: number.positive().max(10000),
        dividerWidthMm: number.positive().max(10000),
        catOpeningRatio: number.positive().max(0.5),
        speakerSlats: number.int().min(2).max(100),
        materialStyle: z.enum(["cabinet", "silver", "aquarium", "authored"]),
        drawerInnerAnodized: z.boolean(),
        dividerDonor: z.boolean(),
        dividerSourceId: id.or(z.literal("")),
        speakerColorRoles: z.record(
          color,
          z.enum([
            "speaker-black-component",
            "speaker-inner-wood-box",
            "speaker-back-anodized",
          ]),
        ),
        scale: z
          .object({
            x: number.positive().max(100),
            y: number.positive().max(100),
            z: number.positive().max(100),
          })
          .strict(),
        rotationDeg: xyz,
        offsetMm: xyz,
      })
      .strict(),
    commerce: z
      .object({
        productHandle: z
          .string()
          .regex(/^[a-z0-9-]*$/)
          .max(200)
          .default(""),
        sku: z.string().max(120),
        colorSkus: z.record(
          z.string().min(1).max(80),
          z.string().min(1).max(120),
        ),
      })
      .strict(),
  })
  .strict();
export type ModelConfig = z.output<typeof modelConfigSchema>;

import { defaultModelConfig } from "../lib/model-config";
export function parseModelConfig(json: string): ModelConfig {
  return modelConfigSchema.parse(
    json === "{}" ? defaultModelConfig() : JSON.parse(json),
  );
}
const placement = z
  .object({
    instanceId: id,
    moduleId: id,
    x: number.int().min(-1000).max(1000),
    y: number.int().min(0).max(1000),
    rotation: z.union([z.literal(0), z.literal(180)]),
    woodColor: z.string().max(80).optional(),
  })
  .strict();
const layout = placement.omit({ instanceId: true });
import { viewerSchema } from "./catalog-viewer-schema.server";
const positive = number.positive().max(10000);
export const settingsSchema = z
  .object({
    defaultPresetId: id,
    defaultWoodColor: text,
    defaultConnectorColor: text,
    copy: z
      .object({
        categories: z.record(text, z.record(text, text)),
        colors: z.record(text, z.record(text, text)),
      })
      .strict(),
    grid: z
      .object({
        xMm: positive,
        yMm: positive,
        frontSign: z.union([z.literal(-1), z.literal(1)]),
        gapMm: number.min(0).max(1000),
      })
      .strict(),
    connectorColors: z
      .record(z.string().min(1).max(40), color)
      .refine((v) => Object.keys(v).length > 0),
    woodColors: z
      .record(z.string().min(1).max(40), color)
      .refine((v) => Object.keys(v).length > 0),
    environmentAssetId: z.string().uuid(),
    presets: z
      .array(
        z
          .object({
            id,
            label: text,
            description: text,
            localizedCopy: z.partialRecord(
              z.enum(["en", "ja", "ko"]),
              z.object({ label: text, description: text }).strict(),
            ),
            previewAssetId: z.string().uuid(),
            previewPosition: z
              .string()
              .regex(/^\d+(?:\.\d+)?% \d+(?:\.\d+)?%$/),
            modules: z.array(placement).min(1).max(300),
          })
          .strict(),
      )
      .max(100),
    materials: z
      .object({
        silverSwatch: color,
        anodizedColor: color,
        anodizedRoughness: number.min(0).max(1),
        metalEnvIntensity: number.min(0).max(10),
        glassEnvIntensity: number.min(0).max(10),
        marineMetalness: number.min(0).max(1),
        marineRoughness: number.min(0).max(1),
        marineEnvIntensity: number.min(0).max(10),
        marineSpecularIntensity: number.min(0).max(1),
        marineSwatchFidelity: number.min(0).max(1),
        speakerBlack: color,
        speakerInner: color,
        speakerMetalness: number.min(0).max(1),
        speakerRoughness: number.min(0).max(1),
        speakerEnvIntensity: number.min(0).max(10),
        boardMinThicknessM: positive,
        boardMaxThicknessM: positive,
        boardMinWidthM: positive,
        boardMinHeightM: positive,
        dividerMinM: xyz,
        dividerMaxM: xyz,
        glassMinTransmission: number.min(0).max(1),
        glassThicknessM: positive,
        glassMaxRoughness: number.min(0).max(1),
      })
      .strict(),
    assembly: z
      .object({
        mountDropMm: positive,
        outerWidthMm: positive,
        outerRightMm: mm,
        outerLeftMm: mm,
        centerXMm: mm,
        outerYMm: mm,
        centerYMm: mm,
        connectorZMm: positive,
        rodXMm: mm,
        rodYMm: mm,
        rodRightMm: mm,
        rodLeftMm: mm,
        supportRightMm: mm,
        supportLeftMm: mm,
        casterZMm: positive,
        footZMm: positive,
      })
      .strict(),
    aquarium: z
      .object({
        fps: number.int().min(1).max(30),
        fishCount: number.int().min(0).max(12),
        insetM: positive,
        waterHeightRatio: number.min(0).max(1),
        fishHeightRatio: number.min(0).max(1),
        waterColor: color,
        waterOpacity: number.min(0).max(1),
        fishColor: color,
        speed: number.min(0).max(5),
      })
      .strict(),
    viewer: viewerSchema,
    bundles: z
      .object({
        parentToComponentFinish: z.record(
          z.string().max(100),
          z.string().max(100),
        ),
        bundles: z
          .array(
            z
              .object({
                parentHandle: text,
                parentTitle: text,
                source: text,
                components: z
                  .array(
                    z
                      .object({
                        catalogId: text,
                        quantity: number.int().positive().max(1000),
                        finish: text,
                      })
                      .strict(),
                  )
                  .max(100),
              })
              .strict(),
          )
          .max(100),
      })
      .strict(),
    bundleSettings: z
      .object({
        PARENT_FINISH_BY_WOOD_COLOR: z.record(text, text),
        WOOD_COLOR_BY_PARENT_FINISH: z.record(text, text),
        EXTRA_BUNDLE_LAYOUTS: z.record(text, z.array(layout).max(300)),
      })
      .strict(),
    inventory: z
      .object({
        parts: z
          .array(
            z
              .object({
                id,
                nameZh: text,
                nameEn: text,
                material: z.enum(["anodized-aluminum", "marine-board"]),
                dimensionsMm: text,
              })
              .strict(),
          )
          .max(300),
        boms: z
          .array(
            z
              .object({
                catalogCode: id,
                moduleId: id,
                nameZh: text,
                nameEn: text,
                requirements: z.record(id, number.int().min(0).max(1000)),
              })
              .strict(),
          )
          .max(300),
      })
      .strict(),
  })
  .strict();
export type CatalogSettingsData = z.output<typeof settingsSchema>;
