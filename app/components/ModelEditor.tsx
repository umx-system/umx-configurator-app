import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Link,
  useBlocker,
  useNavigate,
  useRevalidator,
  useSearchParams,
} from "react-router";
import type { ModelDraft } from "@prisma/client";
import {
  emptyModelForm,
  formatFileSize,
  MAX_GLB_BYTES,
  type ModelFormValues,
  type FieldErrors,
  type SaveResult,
} from "../lib/model-contract";

const ModelPreview = lazy(() => import("./ModelPreview"));

function initialValues(draft: ModelDraft | null): ModelFormValues {
  if (!draft) return { ...emptyModelForm };
  return Object.fromEntries(
    Object.keys(emptyModelForm).map((key) => {
      const value = draft[key as keyof ModelDraft];
      return [key, value == null ? "" : String(value)];
    }),
  ) as ModelFormValues;
}

export function ModelEditor({ draft }: { draft: ModelDraft | null }) {
  const [values, setValues] = useState(() => initialValues(draft));
  const [file, setFile] = useState<File | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const saveLock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [searchParams] = useSearchParams();
  const blocker = useBlocker(dirty && !saved);

  useEffect(() => {
    if (!dirty || saved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saved]);

  useEffect(() => {
    if (!saved || !draft) return;
    revalidator.revalidate();
    // Revalidation remounts the editor with the persisted revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const change = (name: keyof ModelFormValues, value: string) => {
    setValues((previous) => ({ ...previous, [name]: value }));
    setDirty(true);
    setSaved(false);
    setErrors((previous) => ({ ...previous, [name]: undefined }));
  };
  const chooseFile = (selected: File | null) => {
    if (!selected) return;
    if (
      !/\.glb$/i.test(selected.name) ||
      !selected.size ||
      selected.size > MAX_GLB_BYTES
    ) {
      setErrors((previous) => ({
        ...previous,
        file: ["请选择非空的 .glb 文件，最大 25 MB"],
      }));
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setErrors((previous) => ({ ...previous, file: undefined }));
    setFile(selected);
    setDirty(true);
    setSaved(false);
    setPreviewReady(false);
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saveLock.current) return;
    if (!file && !draft) {
      setErrors({ file: ["请先选择 GLB 模型"] });
      return;
    }
    if (file && !previewReady) {
      setMessage("请先完成模型预览，确认文件能正常打开后再保存。");
      return;
    }
    saveLock.current = true;
    setSaving(true);
    setMessage("");
    setErrors({});
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    if (draft) {
      form.set("id", draft.id);
      form.set("revision", String(draft.revision));
    }
    if (file) form.set("file", file);
    try {
      const response = await fetch("/api/model-drafts", {
        method: "POST",
        body: form,
      });
      if (!response.headers.get("content-type")?.includes("application/json"))
        throw new Error("登录状态或网络连接已变化，请重试；当前内容已保留。");
      const result: SaveResult = await response.json();
      if (!result.ok) {
        setMessage(result.message);
        setErrors(result.errors || {});
        return;
      }
      setDirty(false);
      setSaved(true);
      // Wait one render for the unsaved-navigation guard to be disabled.
      requestAnimationFrame(() =>
        navigate(`/app/models/${result.id}?saved=1`, { replace: true }),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "保存失败，当前内容已保留，请重试",
      );
    } finally {
      setSaving(false);
      saveLock.current = false;
    }
  };

  const field = (
    name: keyof ModelFormValues,
    label: string,
    options: {
      type?: "number" | "text";
      required?: boolean;
      min?: number;
      max?: number;
      step?: string;
      placeholder?: string;
      maxLength?: number;
    } = {},
  ) => (
    <label className="field" key={name}>
      <span>
        {label}
        {options.required && <span className="required"> *</span>}
      </span>
      <input
        name={name}
        value={values[name]}
        onChange={(event) => change(name, event.target.value)}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `error-${name}` : undefined}
        {...options}
      />
      {errors[name] && (
        <span className="field-error" id={`error-${name}`}>
          {errors[name]?.[0]}
        </span>
      )}
    </label>
  );

  return (
    <main className="model-app editor-app">
      <Link to="/app" className="back-link">
        ← 模型管理
      </Link>
      <header className="model-header">
        <div>
          <span className="eyebrow">
            UMX / {draft ? "EDIT MODEL" : "NEW MODEL"}
          </span>
          <h1>
            {draft ? draft.label : "新建模型"}{" "}
            <span className="draft-badge">草稿</span>
          </h1>
          <p>上传模型，确认外观，再填写模块参数。</p>
        </div>
        <button
          className="button primary"
          type="submit"
          form="model-form"
          disabled={saving || (!dirty && Boolean(draft))}
        >
          {saving ? "正在上传并保存…" : "保存草稿"}
        </button>
      </header>
      {(saved || (searchParams.has("saved") && !dirty)) && (
        <div className="notice success" role="status">
          草稿已保存。模型和参数已写入后台，尚未发布到配置器。
        </div>
      )}
      {message && (
        <div className="notice error" role="alert">
          {message}
        </div>
      )}
      <form id="model-form" onSubmit={save}>
        <fieldset disabled={saving} className="editor-fieldset">
          <div className="editor-grid">
            <section
              className="model-panel preview-panel"
              aria-labelledby="preview-title"
            >
              <div className="panel-heading">
                <h2 id="preview-title">模型预览</h2>
                <span className="subtle">GLB 2.0 · 最大 25 MB</span>
              </div>
              <Suspense
                fallback={
                  <div className="preview-stage preview-placeholder">
                    正在加载预览工具…
                  </div>
                }
              >
                <ModelPreview
                  key={`${file?.name || draft?.fileKey || "empty"}-${file?.lastModified || ""}-${previewAttempt}`}
                  file={file}
                  draftId={draft?.id}
                  transform={values.previewTransform}
                  onReady={setPreviewReady}
                />
              </Suspense>
              <div className="upload-section">
                <div className="file-summary">
                  <span className="file-type">GLB</span>
                  <div>
                    <strong>
                      {file?.name || draft?.fileName || "还没有模型文件"}
                    </strong>
                    <p>
                      {file
                        ? `${formatFileSize(file.size)} · 已选择，保存时上传`
                        : draft
                          ? `${formatFileSize(draft.fileSize)} · 已保存在后台`
                          : "支持嵌入贴图与 Draco 压缩模型"}
                    </p>
                  </div>
                </div>
                <div className="file-actions">
                  <label className="button file-picker">
                    {file || draft ? "替换 GLB" : "选择 GLB 文件"}
                    <input
                      ref={fileInput}
                      type="file"
                      accept=".glb,model/gltf-binary"
                      aria-label="选择 GLB 文件"
                      onChange={(event) =>
                        chooseFile(event.target.files?.[0] || null)
                      }
                    />
                  </label>
                  {file && (
                    <button
                      className="button text-button"
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setPreviewReady(false);
                        if (fileInput.current) fileInput.current.value = "";
                      }}
                    >
                      {draft ? "恢复已保存文件" : "移除文件"}
                    </button>
                  )}
                  {draft && !file && (
                    <button
                      className="button text-button"
                      type="button"
                      onClick={() => setPreviewAttempt((value) => value + 1)}
                    >
                      重新加载预览
                    </button>
                  )}
                </div>
                {errors.file && (
                  <p className="field-error" role="alert">
                    {errors.file[0]}
                  </p>
                )}
                <label className="field">
                  <span>模型坐标处理</span>
                  <select
                    value={values.previewTransform}
                    onChange={(event) =>
                      change("previewTransform", event.target.value)
                    }
                  >
                    <option value="scene">标准 GLB（保留场景坐标）</option>
                    <option value="rhino">UMX Rhino（对齐现有模块）</option>
                  </select>
                </label>
                <p className="hint">
                  现有 Rhino 模块请选择 UMX Rhino；预览朝向以 −Z
                  为正面。尺寸参数单独保存，不拉伸原模型。
                </p>
              </div>
            </section>
            <div className="parameters-column">
              <section className="model-panel parameter-panel">
                <div className="panel-heading">
                  <h2>基本信息</h2>
                  <span className="subtle">01</span>
                </div>
                <div className="panel-body">
                  {field("label", "模块名称", {
                    required: true,
                    maxLength: 120,
                    placeholder: "例如：M05 开放式模块",
                  })}
                  <div className="two-columns">
                    {field("catalogCode", "模块编码", {
                      maxLength: 64,
                      placeholder: "例如：M05_OPEN",
                    })}
                    {field("shortLabel", "显示简称", {
                      maxLength: 32,
                      placeholder: "留空使用模块名称",
                    })}
                  </div>
                  <p className="hint">
                    编码用于后续关联配置器，每个店铺内保持唯一。
                  </p>
                </div>
              </section>
              <section className="model-panel parameter-panel">
                <div className="panel-heading">
                  <h2>尺寸与占格</h2>
                  <span className="subtle">02</span>
                </div>
                <div className="panel-body">
                  <div className="three-columns">
                    {field("widthMm", "宽度 · mm", {
                      type: "number",
                      required: true,
                      min: 0.0001,
                      max: 10000,
                      step: "any",
                      placeholder: "400",
                    })}
                    {field("depthMm", "深度 · mm", {
                      type: "number",
                      required: true,
                      min: 0.0001,
                      max: 10000,
                      step: "any",
                      placeholder: "400",
                    })}
                    {field("heightMm", "高度 · mm", {
                      type: "number",
                      required: true,
                      min: 0.0001,
                      max: 10000,
                      step: "any",
                      placeholder: "198",
                    })}
                  </div>
                  <div className="two-columns">
                    {field("gridWidth", "横向占格", {
                      type: "number",
                      required: true,
                      min: 1,
                      max: 24,
                      step: "1",
                    })}
                    {field("gridHeight", "纵向占格", {
                      type: "number",
                      required: true,
                      min: 1,
                      max: 24,
                      step: "1",
                    })}
                  </div>
                  <p className="hint">
                    沿用配置器网格：横向 420 mm，纵向 215
                    mm。尺寸以产品实际参数为准。
                  </p>
                </div>
              </section>
              <section className="model-panel parameter-panel">
                <div className="panel-heading">
                  <h2>安装与外观</h2>
                  <span className="subtle">03</span>
                </div>
                <div className="panel-body">
                  <label className="field">
                    <span>放置位置</span>
                    <select
                      value={values.placement}
                      onChange={(event) =>
                        change("placement", event.target.value)
                      }
                    >
                      <option value="grid">网格内安装</option>
                      <option value="top">顶部安装</option>
                    </select>
                  </label>
                  <div className="two-columns">
                    {field("frontWidthMm", "正面宽度 · mm", {
                      type: "number",
                      min: 0.0001,
                      max: 10000,
                      step: "any",
                      placeholder: "可选",
                    })}
                    {field("placementYOffsetMm", "垂直偏移 · mm", {
                      type: "number",
                      required: true,
                      min: -10000,
                      max: 10000,
                      step: "any",
                    })}
                  </div>
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={values.supportsMarineBoardColor === "true"}
                      onChange={(event) =>
                        change(
                          "supportsMarineBoardColor",
                          String(event.target.checked),
                        )
                      }
                    />
                    <span>支持海洋板颜色切换</span>
                  </label>
                  <p className="hint">
                    记录模块可用能力；颜色切换效果将在接入配置器时应用。
                  </p>
                  <label className="field">
                    <span>备注</span>
                    <textarea
                      name="note"
                      value={values.note}
                      onChange={(event) => change("note", event.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="记录模块说明、安装方式或待补充信息"
                    />
                  </label>
                  {errors.note && (
                    <p className="field-error">{errors.note[0]}</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        </fieldset>
      </form>
      <footer className="editor-footer">
        <span>
          {dirty
            ? "有未保存的修改"
            : draft
              ? `已保存 · 修订 ${draft.revision}`
              : "填写标有 * 的必填参数后保存"}
        </span>
        <span>分类、可见范围与渠道价格将在后续接入</span>
      </footer>
      {blocker.state === "blocked" && (
        <div className="modal-backdrop">
          <div
            className="model-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-title"
          >
            <h2 id="leave-title">还有未保存的修改</h2>
            <p>离开后，本次修改和选中的文件将不会保存。</p>
            <div className="file-actions">
              <button
                className="button primary"
                type="button"
                onClick={() => blocker.reset()}
              >
                继续编辑
              </button>
              <button
                className="button"
                type="button"
                onClick={() => blocker.proceed()}
              >
                放弃修改并离开
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
