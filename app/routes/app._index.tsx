import { publishedModelRevisions } from "../services/catalog-status.server";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, Form, Link, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { models } from "../services/models.server";
import { formatFileSize } from "../lib/model-contract";
import "../styles/models.css";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const search = (url.searchParams.get("q") || "").slice(0, 120);
  const page = Math.max(
    1,
    Math.min(100000, Math.floor(Number(url.searchParams.get("page")) || 1)),
  );
  const [drafts, count] = await models.list(session.shop, search, page);
  return data(
    {
      drafts,
      count,
      search,
      page,
      published: await publishedModelRevisions(session.shop),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export default function ModelLibrary() {
  const { drafts, count, search, page, published } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  return (
    <main className="model-app">
      <header className="model-header">
        <div>
          <span className="eyebrow">UMX / MODEL LIBRARY</span>
          <h1>模型管理</h1>
          <p>维护全部模块、配件与独立产品，发布后由配置器读取。</p>
        </div>
        <Link className="button" to="/app/catalog">
          目录设置与发布
        </Link>
        <Link className="button primary" to="/app/models/new">
          ＋ 新建模型
        </Link>
      </header>
      <section className="model-panel library-panel" aria-label="模型草稿">
        <div className="library-toolbar">
          <div>
            <h2>
              模型草稿 <span className="count">{count}</span>
            </h2>
            <p>修改保存为草稿，在目录设置中统一发布或恢复历史版本。</p>
          </div>
          <Form method="get" className="search-form" role="search">
            <label className="sr-only" htmlFor="search">
              搜索名称或编码
            </label>
            <input
              id="search"
              name="q"
              defaultValue={search}
              placeholder="搜索名称或编码"
              maxLength={120}
            />
            <button
              className="button"
              type="submit"
              disabled={navigation.state !== "idle"}
            >
              搜索
            </button>
          </Form>
        </div>
        {drafts.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>模块</th>
                  <th>尺寸 · mm</th>
                  <th>占格 / 放置</th>
                  <th>模型文件</th>
                  <th>更新日期</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr key={draft.id}>
                    <td>
                      <Link
                        className="model-name"
                        to={`/app/models/${draft.id}`}
                      >
                        {draft.label}
                      </Link>
                      <span className="cell-detail mono">
                        {draft.catalogCode || "未设置编码"}
                      </span>
                    </td>
                    <td className="mono">
                      {[draft.widthMm, draft.depthMm, draft.heightMm]
                        .map((n) =>
                          new Intl.NumberFormat("en", {
                            maximumFractionDigits: 4,
                          }).format(n),
                        )
                        .join(" × ")}
                      <span className="cell-detail">宽 × 深 × 高</span>
                    </td>
                    <td>
                      {draft.gridWidth} × {draft.gridHeight}
                      <span className="cell-detail">
                        {draft.placement === "top" ? "顶部安装" : "网格内安装"}
                      </span>
                    </td>
                    <td>
                      <span className="file-cell" title={draft.fileName}>
                        {draft.fileName}
                      </span>
                      <span className="cell-detail">
                        {formatFileSize(draft.fileSize)}
                      </span>
                    </td>
                    <td className="mono">
                      {new Date(draft.updatedAt).toISOString().slice(0, 10)}
                      <span className="cell-detail">修订 {draft.revision}</span>
                    </td>
                    <td>
                      <span className="draft-badge">
                        {published[draft.id] === draft.revision
                          ? "已发布"
                          : published[draft.id]
                            ? "有未发布修改"
                            : "未发布"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-library">
            <span className="empty-symbol" aria-hidden="true">
              ◇
            </span>
            <h2>{search ? "没有找到匹配的模型" : "添加第一个模块模型"}</h2>
            <p>
              {search
                ? "换一个名称或编码试试。"
                : "选择 GLB 文件，预览模型并填写尺寸与占格参数。"}
            </p>
            <Link className="button" to={search ? "/app" : "/app/models/new"}>
              {search ? "查看全部模型" : "新建模型"}
            </Link>
          </div>
        )}
        {count > 30 && (
          <nav className="pagination" aria-label="草稿分页">
            {page > 1 && (
              <Link to={`?q=${encodeURIComponent(search)}&page=${page - 1}`}>
                上一页
              </Link>
            )}
            <span>第 {page} 页</span>
            {page * 30 < count && (
              <Link to={`?q=${encodeURIComponent(search)}&page=${page + 1}`}>
                下一页
              </Link>
            )}
          </nav>
        )}
      </section>
      <p className="library-footnote">
        模型文件与目录数据保存在 App，前端只读取当前用户可见的发布目录。
      </p>
    </main>
  );
}

export const headers: HeadersFunction = (args) => {
  const headers = new Headers(boundary.headers(args));
  headers.set("Cache-Control", "private, no-store");
  return headers;
};
