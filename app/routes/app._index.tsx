import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <s-page heading="Configurator Dashboard">
      <s-section heading="配置器管理">
        <s-paragraph>
          在这里统一维护配置器的模块模型、分类、展示范围和渠道价格。
        </s-paragraph>
        <s-paragraph>
          应用目前处于初始化阶段，管理功能将在后续版本提供。
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
