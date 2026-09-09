import type { ModelConfig } from "../services/catalog-schema.server";
// Defaults describe generic capabilities, never proprietary catalog data.
export function defaultModelConfig(): ModelConfig {
  const copy = { label: "", shortLabel: "", catalogName: "", note: "" };
  return {
    kind: "module",
    slot: "",
    enabled: true,
    catalogName: "",
    category: "收纳模块",
    sortOrder: 0,
    audiences: ["consumer", "business", "internal"],
    prices: { consumer: null, business: null, internal: null },
    thumbnailAssetId: "",
    thumbnailLightAssetId: "",
    localizedCopy: { en: { ...copy }, ja: { ...copy }, ko: { ...copy } },
    motion: {
      kind: "none",
      distanceMm: 0,
      angleDeg: 0,
      pivotMm: { x: 0, y: 0, z: 0 },
      openDurationMs: 980,
      closeDurationMs: 760,
      fallbackFrontPanel: false,
      nodePrefix: "UMX_MOTION",
    },
    render: {
      blocksStackingAbove: false,
      linework: "generic",
      lineworkUseFullWidth: false,
      dividerPositionsMm: [],
      dividerReferenceWidthMm: 1,
      dividerWidthMm: 1,
      catOpeningRatio: 0.23,
      speakerSlats: 19,
      materialStyle: "cabinet",
      drawerInnerAnodized: false,
      dividerDonor: false,
      dividerSourceId: "",
      speakerColorRoles: {},
      scale: { x: 1, y: 1, z: 1 },
      rotationDeg: { x: 0, y: 0, z: 0 },
      offsetMm: { x: 0, y: 0, z: 0 },
    },
    commerce: { productHandle: "", sku: "", colorSkus: {} },
  };
}
