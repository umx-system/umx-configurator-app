/* eslint-env node */
import express from "express";
import { createRequestHandler } from "@react-router/express";
import * as build from "../build/server/index.js";

const app = express();
app.disable("x-powered-by");
app.use(
  "/assets",
  express.static("build/client/assets", { immutable: true, maxAge: "1y" }),
);
app.use(express.static("build/client"));
app.use(express.static("public", { maxAge: "1h" }));
// Shopify signed requests carry session tokens in their query strings.
// Intentionally omit request URL logging; health and Docker status provide liveness.
app.all("*", createRequestHandler({ build, mode: process.env.NODE_ENV }));
const server = app.listen(
  Number(process.env.PORT || 3000),
  process.env.HOST || "0.0.0.0",
  () => {
    console.info("Configurator server listening");
  },
);
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 15000).unref();
  });
}
