import { useState } from "react";
const labels: Record<string, string> = {
  productHandle: "Shopify 商品网址代号",
  kind: "模型类型",
  slot: "用途",
  enabled: "启用",
  catalogName: "目录名称",
  category: "分类",
  sortOrder: "排序",
  audiences: "可见用户",
  prices: "渠道预估单价 · USD",
  consumer: "零售用户",
  business: "企业用户",
  internal: "内部用户",
  localizedCopy: "多语言名称与说明",
  en: "English",
  ja: "日本語",
  ko: "한국어",
  label: "名称",
  shortLabel: "简称",
  note: "说明",
  motion: "开合动作",
  distanceMm: "移动距离 · mm",
  angleDeg: "旋转角度 · °",
  pivotMm: "转轴位置 · mm",
  openDurationMs: "打开时长 · ms",
  closeDurationMs: "关闭时长 · ms",
  fallbackFrontPanel: "自动识别最前面的面板",
  nodePrefix: "开合部件名称前缀",
  render: "模型外观与坐标",
  materialStyle: "材质处理",
  drawerInnerAnodized: "抽屉内斗使用阳极氧化铝",
  dividerDonor: "可提供内部隔板",
  dividerSourceId: "内部隔板来源编号",
  speakerColorRoles: "音箱源颜色对应部件",
  scale: "缩放比例",
  rotationDeg: "旋转 · °",
  offsetMm: "位置微调 · mm",
  commerce: "Shopify 商品对应",
  sku: "默认 SKU",
  colorSkus: "按板色对应 SKU",
  grid: "组合网格",
  xMm: "横向间距 · mm",
  yMm: "纵向间距 · mm",
  frontSign: "产品正面方向",
  gapMm: "安装间隙 · mm",
  connectorColors: "连接件配色",
  woodColors: "板材配色",
  presets: "组合范例",
  id: "稳定编号",
  description: "说明",
  previewPosition: "封面位置",
  modules: "组合内模块",
  moduleId: "模型编号",
  instanceId: "组合内编号",
  rotation: "旋转角度",
  woodColor: "板材颜色",
  materials: "共享材质参数",
  assembly: "配件安装位置",
  aquarium: "鱼缸效果",
  viewer: "场景与光照",
  bundles: "固定组合商品",
  bundleSettings: "组合商品匹配",
  inventory: "内部零件与用料",
  parts: "零件",
  boms: "模块用料清单",
  requirements: "零件数量",
  nameZh: "中文名称",
  nameEn: "英文名称",
  dimensionsMm: "尺寸 · mm",
  material: "材质",
  catalogCode: "目录编码",
  parentHandle: "母商品网址代号",
  parentTitle: "母商品名称",
  source: "组合编号",
  components: "组合配件",
  catalogId: "配件标识",
  quantity: "数量",
  finish: "表面处理",
  thumbnailAssetId: "深色缩略图",
  thumbnailLightAssetId: "浅色缩略图",
  environmentAssetId: "环境贴图",
  previewAssetId: "组合封面",
};
Object.assign(labels, {
  blocksStackingAbove: "禁止上方继续叠放",
  linework: "二维轮廓",
  lineworkUseFullWidth: "二维使用完整外宽",
  dividerPositionsMm: "隔板横向位置 · mm",
  dividerReferenceWidthMm: "隔板参考柜宽 · mm",
  dividerWidthMm: "隔板宽度 · mm",
  catOpeningRatio: "猫窝开口半径比例",
  speakerSlats: "音箱格栅条数",
  defaultPresetId: "默认组合编号",
  defaultWoodColor: "默认板材颜色",
  defaultConnectorColor: "默认连接件颜色",
  copy: "分类与配色多语言",
  categories: "分类名称",
  colors: "颜色名称",
  silverSwatch: "银色样本",
  anodizedColor: "阳极氧化铝底色",
  anodizedRoughness: "铝材粗糙度",
  metalEnvIntensity: "金属环境反射强度",
  glassEnvIntensity: "玻璃环境反射强度",
  marineMetalness: "板材金属度",
  marineRoughness: "板材粗糙度",
  marineEnvIntensity: "板材环境反射强度",
  marineSpecularIntensity: "板材高光强度",
  marineSwatchFidelity: "板材颜色还原比例",
  speakerBlack: "音箱部件黑色",
  speakerInner: "音箱内箱颜色",
  speakerMetalness: "音箱部件金属度",
  speakerRoughness: "音箱部件粗糙度",
  speakerEnvIntensity: "音箱部件反射强度",
  boardMinThicknessM: "面板最小厚度 · m",
  boardMaxThicknessM: "面板最大厚度 · m",
  boardMinWidthM: "面板最小宽度 · m",
  boardMinHeightM: "面板最小高度 · m",
  dividerMinM: "隔板识别最小尺寸 · m",
  dividerMaxM: "隔板识别最大尺寸 · m",
  glassMinTransmission: "玻璃最低透光率",
  glassThicknessM: "玻璃厚度 · m",
  glassMaxRoughness: "玻璃最大粗糙度",
  mountDropMm: "底部安装下移 · mm",
  outerWidthMm: "边连接件外宽 · mm",
  outerRightMm: "右向边件偏移 · mm",
  outerLeftMm: "左向边件偏移 · mm",
  centerXMm: "中件横向偏移 · mm",
  outerYMm: "边件高度偏移 · mm",
  centerYMm: "中件高度偏移 · mm",
  connectorZMm: "连接件前后间距的一半 · mm",
  rodXMm: "横杆位置 · mm",
  rodYMm: "底杆高度偏移 · mm",
  rodRightMm: "右向底杆偏移 · mm",
  rodLeftMm: "左向底杆偏移 · mm",
  supportRightMm: "右侧支撑偏移 · mm",
  supportLeftMm: "左侧支撑偏移 · mm",
  casterZMm: "脚轮前后间距的一半 · mm",
  footZMm: "脚撑前后间距的一半 · mm",
  fps: "动画每秒帧数",
  fishCount: "鱼的数量",
  insetM: "水面边缘间隙 · m",
  waterHeightRatio: "水位比例",
  fishHeightRatio: "鱼群高度比例",
  waterColor: "水面颜色",
  waterOpacity: "水面不透明度",
  fishColor: "鱼的颜色",
  speed: "游动速度倍数",
  VIEWER_GRID_SIZE_M: "地面网格尺寸 · m",
  VIEWER_GRID_DIVISIONS: "地面网格分段数",
  VIEWER_FLOOR_SIZE_M: "地板尺寸 · m",
  VIEWER_GRID_MAJOR_EVERY: "主网格间隔",
  VIEWER_GRID_MEDIUM_EVERY: "次网格间隔",
  VIEWER_GRID_CROSS_ARMS_M: "网格十字大小 · m",
  VIEWER_GRID_CENTER_DASHES_M: "网格中心短线 · m",
  VIEWER_GRID_POINTER_RADIUS_M: "网格鼠标影响半径 · m",
  VIEWER_FOG_NEAR_M: "雾效起点 · m",
  VIEWER_FOG_FAR_M: "雾效终点 · m",
  VIEWER_GRID_PALETTES: "网格颜色数值",
  LIGHTING_PROFILES: "场景光照方案",
  light: "浅色",
  dark: "深色",
  blackRender: "黑底出图",
  exposure: "曝光",
  environmentIntensity: "环境光强度",
  sky: "天空颜色数值",
  ground: "地面颜色数值",
  hemisphereIntensity: "半球光强度",
  keyColor: "主光颜色数值",
  keyIntensity: "主光强度",
  rimColor: "轮廓光颜色数值",
  rimIntensity: "轮廓光强度",
  PARENT_FINISH_BY_WOOD_COLOR: "板色对应母商品选项",
  WOOD_COLOR_BY_PARENT_FINISH: "母商品选项对应板色",
  EXTRA_BUNDLE_LAYOUTS: "其他固定组合布局",
  parentToComponentFinish: "母子商品表面处理对应",
});
const arrayTemplates: Record<string, unknown> = {
  dividerPositionsMm: 0,
  modules: {
    instanceId: "new-placement",
    moduleId: "",
    x: 0,
    y: 0,
    rotation: 0,
  },
  presets: {
    id: "new-preset",
    label: "新组合",
    description: "",
    localizedCopy: {
      en: { label: "", description: "" },
      ja: { label: "", description: "" },
      ko: { label: "", description: "" },
    },
    previewAssetId: "",
    previewPosition: "50% 50%",
    modules: [],
  },
  parts: {
    id: "new-part",
    nameZh: "新零件",
    nameEn: "",
    material: "anodized-aluminum",
    dimensionsMm: "",
  },
  boms: {
    catalogCode: "new-bom",
    moduleId: "",
    nameZh: "",
    nameEn: "",
    requirements: {},
  },
  components: { catalogId: "", quantity: 1, finish: "" },
  bundles: { parentHandle: "", parentTitle: "", source: "", components: [] },
};
const mapDefaults: Record<string, unknown> = {
  colorSkus: "",
  speakerColorRoles: "speaker-black-component",
  woodColors: "#ffffff",
  connectorColors: "#ffffff",
  requirements: 1,
  categories: { en: "", ja: "", ko: "" },
  colors: { en: "", ja: "", ko: "" },
  PARENT_FINISH_BY_WOOD_COLOR: "",
  WOOD_COLOR_BY_PARENT_FINISH: "",
  parentToComponentFinish: "",
  EXTRA_BUNDLE_LAYOUTS: [],
};
const options: Record<string, string[]> = {
  kind: ["module", "accessory", "product", "none", "translate-z", "rotate-x"],
  slot: ["", "outer", "center", "baseRod", "caster", "footSupport", "chair"],
  materialStyle: ["cabinet", "silver", "aquarium", "authored"],
  linework: [
    "open",
    "drawer",
    "drop-front",
    "cat-house",
    "aquarium",
    "speaker",
    "top-panel",
    "generic",
  ],
  audiences: ["consumer", "business", "internal"],
};
const optionLabels: Record<string, string> = {
  module: "组合模块",
  accessory: "配件",
  product: "独立产品",
  none: "无开合",
  "translate-z": "抽拉",
  "rotate-x": "翻转",
  outer: "边连接件",
  center: "中连接件",
  baseRod: "底杆",
  caster: "脚轮",
  footSupport: "脚撑",
  chair: "独立产品预览",
  cabinet: "模块柜材质",
  silver: "银色金属",
  aquarium: "鱼缸玻璃",
  authored: "保留文件内材质",
  open: "开放格",
  drawer: "抽屉",
  "drop-front": "下翻门",
  "cat-house": "猫窝",
  speaker: "音箱",
  "top-panel": "顶板",
  generic: "通用外框",
  consumer: "零售用户",
  business: "企业用户",
  internal: "内部用户",
};
export type AssetOption = { id: string; name: string; mimeType: string };
export function ConfigFields({
  value,
  onChange,
  name = "",
  assets = [],
  depth = 0,
  emptyItem,
}: {
  emptyItem?: unknown;
  value: unknown;
  onChange: (v: unknown) => void;
  name?: string;
  assets?: AssetOption[];
  depth?: number;
}) {
  const [newKey, setNewKey] = useState("");
  const title = labels[name] || name;
  if (Array.isArray(value)) {
    if (name === "audiences")
      return (
        <fieldset className="config-group">
          <legend>{title}</legend>
          {options.audiences.map((a) => (
            <label className="checkbox-field" key={a}>
              <input
                type="checkbox"
                checked={value.includes(a)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, a]
                      : value.filter((v) => v !== a),
                  )
                }
              />
              {optionLabels[a]}
            </label>
          ))}
        </fieldset>
      );
    return (
      <details className="config-group">
        <summary>
          {title} · {value.length}
        </summary>
        {value.map((item, i) => (
          <div className="config-array-item" key={i}>
            <ConfigFields
              value={item}
              onChange={(v) =>
                onChange(value.map((old, j) => (j === i ? v : old)))
              }
              name={String(i + 1)}
              assets={assets}
              depth={depth + 1}
            />
            <button
              type="button"
              className="button text-button"
              onClick={() => onChange(value.filter((_, j) => i !== j))}
            >
              移除这一项
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button"
          disabled={
            !value.length &&
            !(name in arrayTemplates) &&
            emptyItem === undefined
          }
          onClick={() =>
            onChange([
              ...value,
              structuredClone(
                value.length
                  ? value[value.length - 1]
                  : (emptyItem ?? arrayTemplates[name]),
              ),
            ])
          }
        >
          {value.length ? "复制最后一项" : "添加第一项"}
        </button>
      </details>
    );
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    const content = (
      <>
        {entries.map(([key, v]) => (
          <ConfigFields
            key={key}
            name={key}
            emptyItem={
              name === "EXTRA_BUNDLE_LAYOUTS"
                ? { moduleId: "", x: 0, y: 0, rotation: 0 }
                : undefined
            }
            value={v}
            assets={assets}
            depth={depth + 1}
            onChange={(next) => onChange({ ...value, [key]: next })}
          />
        ))}
        {name in mapDefaults && (
          <div className="map-editor">
            <input
              aria-label={`${title}新键名`}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder={
                name === "speakerColorRoles" ? "源颜色，如 #ff0000" : "新增名称"
              }
            />
            <button
              type="button"
              className="button"
              disabled={
                !newKey.trim() ||
                ["__proto__", "constructor", "prototype"].includes(
                  newKey.trim(),
                )
              }
              onClick={() => {
                onChange({
                  ...value,
                  [newKey.trim()]: structuredClone(mapDefaults[name]),
                });
                setNewKey("");
              }}
            >
              添加
            </button>
            {entries.map(([key]) => (
              <button
                key={key}
                type="button"
                className="button text-button"
                onClick={() =>
                  onChange(
                    Object.fromEntries(entries.filter(([k]) => k !== key)),
                  )
                }
              >
                移除 {key}
              </button>
            ))}
          </div>
        )}
      </>
    );
    return depth === 0 ? (
      <div className="config-fields">{content}</div>
    ) : (
      <details className="config-group" open={depth === 1}>
        <summary>{title}</summary>
        <div className="panel-body">{content}</div>
      </details>
    );
  }
  if (typeof value === "boolean")
    return (
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
        {title}
      </label>
    );
  if (name.endsWith("AssetId"))
    return (
      <label className="field">
        <span>{title}</span>
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">未选择</option>
          {assets
            .filter((a) =>
              name === "environmentAssetId"
                ? a.mimeType === "image/vnd.radiance"
                : a.mimeType !== "image/vnd.radiance",
            )
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
        </select>
      </label>
    );
  let choices = options[name];
  if (name === "kind")
    choices = String(value).match(/^(module|accessory|product)$/)
      ? options.kind.slice(0, 3)
      : options.kind.slice(3);
  if (choices)
    return (
      <label className="field">
        <span>{title}</span>
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          {choices.map((o) => (
            <option key={o} value={o}>
              {optionLabels[o] || o || "无"}
            </option>
          ))}
        </select>
      </label>
    );
  return (
    <label className="field">
      <span>
        {title}
        {value === null ? " · 未设置时需询价" : ""}
      </span>
      <input
        value={value === null ? "" : String(value)}
        type={typeof value === "number" || value === null ? "number" : "text"}
        step="any"
        onChange={(e) =>
          onChange(
            typeof value === "number" || value === null
              ? e.target.value === ""
                ? null
                : Number(e.target.value)
              : e.target.value,
          )
        }
      />
    </label>
  );
}
