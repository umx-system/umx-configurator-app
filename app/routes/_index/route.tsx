import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Configurator Dashboard</h1>
        <p className={styles.text}>
          配置器管理应用。请通过 Shopify 后台打开已安装的应用。
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>店铺域名</span>
              <input className={styles.input} type="text" name="shop" />
              <span>例如：your-store.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              前往 Shopify 登录
            </button>
          </Form>
        )}
      </div>
    </div>
  );
}
