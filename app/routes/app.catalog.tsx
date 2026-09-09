import {
  settingsSchema,
  modelConfigSchema,
} from "../services/catalog-schema.server";
import { useState } from "react";
import {
  data,
  Link,
  useLoaderData,
  useRevalidator,
  useBlocker,
  type LoaderFunctionArgs,
} from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { catalogFingerprint } from "../services/catalog.server";
import { ConfigFields } from "../components/ConfigFields";
import { AssetUpload } from "../components/AssetUpload";
import "../styles/models.css";
export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const [settings, assets, models, releases, publication] = await Promise.all([
    db.catalogSettings.findUnique({ where: { shop: session.shop } }),
    db.catalogAsset.findMany({
      where: { shop: session.shop },
      select: { id: true, name: true, mimeType: true },
    }),
    db.modelDraft.findMany({
      where: { shop: session.shop },
      select: { id: true, revision: true },
    }),
    db.catalogRelease.findMany({
      where: { shop: session.shop },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, createdAt: true, json: true },
    }),
    db.catalogPublication.findUnique({ where: { shop: session.shop } }),
  ]);
  return data(
    {
      settings,
      assets,
      releases: releases.map(({ json, ...r }) => {
        const payload = JSON.parse(json);
        return {
          ...r,
          compatible:
            settingsSchema.safeParse(payload.settings).success &&
            payload.models.every(
              (m: { config: unknown }) =>
                modelConfigSchema.safeParse(m.config).success,
            ),
        };
      }),
      publication,
      count: models.length,
      fingerprint: catalogFingerprint(models, settings?.revision ?? 0),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export default function CatalogPage() {
  const loaded = useLoaderData<typeof loader>();
  return (
    <CatalogEditor
      key={`${loaded.settings?.revision}-${loaded.publication?.releaseId}`}
      loaded={loaded}
    />
  );
}
function CatalogEditor({
  loaded,
}: {
  loaded: ReturnType<typeof useLoaderData<typeof loader>>;
}) {
  const [value, setValue] = useState<unknown>(() =>
    loaded.settings ? JSON.parse(loaded.settings.json) : null,
  );
  const [assets, setAssets] = useState(loaded.assets);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const revalidator = useRevalidator();
  const blocker = useBlocker(dirty);
  async function run(operation: string, releaseId?: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/catalog-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation,
          settings: value,
          revision: loaded.settings?.revision,
          fingerprint: loaded.fingerprint,
          releaseId,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        throw new Error(result.message || "操作失败");
      setDirty(false);
      setMessage(
        operation === "save"
          ? "目录设置已保存为草稿"
          : operation === "publish"
            ? "已发布，配置器刷新后读取新版本"
            : "已恢复所选版本",
      );
      revalidator.revalidate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="model-app catalog-settings">
      <header className="model-header">
        <div>
          <span className="eyebrow">UMX / CATALOG</span>
          <h1>目录设置与发布</h1>
          <p>{loaded.count} 个模型 · 草稿保存后统一发布</p>
        </div>
        <Link className="button" to="/app">
          返回模型管理
        </Link>
      </header>
      {message && (
        <p role="status" className="save-message">
          {message}
        </p>
      )}
      <section className="model-panel">
        <div className="panel-heading">
          <h2>发布目录</h2>
          <span className="draft-badge">
            {loaded.publication ? "已有发布版本" : "尚未发布"}
          </span>
        </div>
        <div className="panel-body">
          <p>
            发布会校验模型、图片与组合引用。配置器读取发布版本；保存草稿不会影响已发布内容。
          </p>
          <div className="release-actions">
            <button
              className="button primary"
              disabled={busy || dirty || !loaded.settings}
              onClick={() => run("publish")}
            >
              发布当前全部草稿
            </button>
            <span>{dirty ? "请先保存目录设置" : "发布后刷新配置器查看"}</span>
          </div>
          {loaded.releases.map((r) => (
            <div className="release-actions" key={r.id}>
              <span>
                {new Date(r.createdAt)
                  .toISOString()
                  .replace("T", " ")
                  .slice(0, 19)}{" "}
                · {r.id.slice(0, 8)}
              </span>
              {r.id === loaded.publication?.releaseId ? (
                <strong>当前版本</strong>
              ) : (
                <button
                  className="button"
                  disabled={busy || dirty || !r.compatible}
                  onClick={() => run("rollback", r.id)}
                >
                  {r.compatible ? "恢复此版本" : "旧格式不可恢复"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      {value ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run("save");
          }}
        >
          <fieldset disabled={busy} className="editor-fieldset">
            <section className="model-panel">
              <div className="panel-heading">
                <h2>共享配置与组合资料</h2>
                <button className="button primary" type="submit">
                  保存目录设置草稿
                </button>
              </div>
              <div className="panel-body">
                <AssetUpload
                  onUploaded={(a) => setAssets((old) => [a, ...old])}
                />
                <ConfigFields
                  value={value}
                  assets={assets}
                  onChange={(v) => {
                    setValue(v);
                    setDirty(true);
                  }}
                />
              </div>
            </section>
          </fieldset>
        </form>
      ) : (
        <p>尚未导入目录，请先运行迁移工具建立共享配置。</p>
      )}
      {blocker.state === "blocked" && (
        <div className="modal-backdrop">
          <div
            className="model-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="尚未保存"
          >
            <p>目录设置尚未保存。</p>
            <button className="button primary" onClick={() => blocker.reset()}>
              继续编辑
            </button>
            <button className="button" onClick={() => blocker.proceed()}>
              放弃并离开
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
