import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { createModelDraftService } from "../app/services/model-drafts.server";
import { createAssetService } from "../app/services/catalog-assets.server";
import {
  createCatalogService,
  catalogFingerprint,
  audienceFromTags,
  validAssetSignature,
} from "../app/services/catalog.server";
import { modelMetadataSchema } from "../app/services/model-metadata.server";
import { defaultModelConfig } from "../app/lib/model-config";
import { emptyModelForm } from "../app/lib/model-contract";
import { settingsSchema } from "../app/services/catalog-schema.server";
import { glb } from "./fixtures/glb";
const shop = "catalog-test.myshopify.com";
const secret = "synthetic-test-secret";
let root: string;
let db: PrismaClient;
let models: ReturnType<typeof createModelDraftService>;
let catalog: ReturnType<typeof createCatalogService>;
let firstRelease: string;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZl8AAAAASUVORK5CYII=",
  "base64",
);
async function fingerprint() {
  const s = await db.catalogSettings.findUniqueOrThrow({ where: { shop } });
  return catalogFingerprint(
    await db.modelDraft.findMany({ where: { shop } }),
    s.revision,
  );
}
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "catalog-test-"));
  const database = path.join(root, "db.sqlite");
  await writeFile(database, "");
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      env: { ...process.env, DATABASE_URL: `file:${database}` },
      stdio: "pipe",
    },
  );
  db = new PrismaClient({ datasourceUrl: `file:${database}` });
  models = createModelDraftService(db, path.join(root, "models"));
  const assets = createAssetService(db, path.join(root, "assets"));
  catalog = createCatalogService(
    db,
    path.join(root, "models"),
    path.join(root, "assets"),
    secret,
  );
  const thumbnail = await assets.save(shop, "test.png", png);
  const settings = JSON.parse(
    await readFile(
      new URL("./fixtures/settings.json", import.meta.url),
      "utf8",
    ),
  );
  settings.environmentAssetId = thumbnail.id;
  settings.presets[0].previewAssetId = thumbnail.id;
  await db.catalogSettings.create({
    data: { shop, json: JSON.stringify(settingsSchema.parse(settings)) },
  });
  for (const [index, slot] of [
    "",
    "outer",
    "center",
    "baseRod",
    "caster",
    "footSupport",
    "private",
  ].entries()) {
    const c = defaultModelConfig();
    c.prices = { consumer: 100, business: 80, internal: 40 };
    c.thumbnailAssetId = thumbnail.id;
    if (slot && slot !== "private") {
      c.kind = "accessory";
      c.slot = slot as typeof c.slot;
    }
    if (slot === "private") {
      c.audiences = ["business", "internal"];
      c.prices.consumer = null;
    }
    const metadata = modelMetadataSchema.parse({
      ...emptyModelForm,
      modelId: index === 0 ? "TEST_MODULE" : `TEST_${index}`,
      catalogCode: `TEST_${index}`,
      label: "Synthetic model",
      widthMm: "400",
      heightMm: "198",
      depthMm: "400",
      configJson: JSON.stringify(c),
    });
    await models.save(shop, metadata, null, { bytes: glb(), name: "test.glb" });
  }
  firstRelease = (await catalog.publish(shop, await fingerprint())).id;
});
after(async () => {
  await db?.$disconnect();
  if (root) await rm(root, { recursive: true, force: true });
});
test("exact tag matching honors internal > business > retail without normalizing untrusted spelling", () => {
  assert.equal(audienceFromTags([]), "consumer");
  assert.equal(audienceFromTags(["Tob", "nb-x"]), "consumer");
  assert.equal(audienceFromTags(["tob"]), "business");
  assert.equal(audienceFromTags(["tob", "nb"]), "internal");
});
test("initial projection excludes restricted models, every other channel price and private BOM", async () => {
  const base = await catalog.deliver(
    shop,
    "internal",
    "https://app.example",
    "base",
  );
  assert.ok(base.models);
  assert.equal(base.models.length, 6);
  assert.equal(base.audience, "internal");
  assert.ok(base.models.every((m) => m.unitPrice === 40));
  assert.doesNotMatch(
    JSON.stringify(base),
    /PRIVATE-PART|"prices"|"fileKey"|"audiences"|TEST_6/,
  );
  const retail = await catalog.deliver(
    shop,
    "consumer",
    "https://app.example",
    "base",
  );
  assert.ok(retail.models);
  assert.ok(retail.models.every((m) => m.unitPrice === 100));
  const business = await catalog.deliver(
    shop,
    "business",
    "https://app.example",
    "library",
  );
  assert.ok(business.models);
  assert.equal(business.models.length, 7);
  assert.ok(business.models.every((m) => m.unitPrice === 80));
  await assert.rejects(
    catalog.deliver(shop, "business", "https://app.example", "inventory"),
    /无权/,
  );
  const internal = await catalog.deliver(
    shop,
    "internal",
    "https://app.example",
    "inventory",
  );
  assert.ok(internal.inventory);
  assert.equal(internal.inventory.parts[0].id, "PRIVATE-PART");
});
test("signed asset capabilities reject tampered model, shop, expiry and release parameters", async () => {
  const response = await catalog.deliver(
    shop,
    "consumer",
    "https://app.example",
  );
  assert.ok(response.models);
  const original = new URL(response.models[0].model);
  assert.equal(validAssetSignature(secret, original), true);
  assert.deepEqual((await catalog.readAsset(original)).bytes, glb());
  for (const key of ["shop", "model", "part", "expires", "release"]) {
    const url = new URL(original);
    url.searchParams.set(key, "tampered");
    assert.equal(validAssetSignature(secret, url), false);
    await assert.rejects(catalog.readAsset(url));
  }
  assert.equal(
    validAssetSignature(secret, original, Date.now() + 7 * 3600000),
    false,
  );
  await assert.rejects(catalog.readRelease("other.myshopify.com"), /尚未发布/);
});
test("drafts do not change published data; stale publish is rejected; old files remain available after rollback", async () => {
  const before = await db.modelDraft.findFirstOrThrow({
    where: { shop, modelId: "TEST_MODULE" },
  });
  const priorFingerprint = await fingerprint();
  const metadata = modelMetadataSchema.parse({
    ...emptyModelForm,
    modelId: before.modelId!,
    label: "Edited model",
    catalogCode: before.catalogCode!,
    widthMm: "420",
    heightMm: "198",
    depthMm: "400",
    configJson: before.configJson,
  });
  await models.save(
    shop,
    metadata,
    { id: before.id, revision: before.revision },
    {
      bytes: glb((doc) => {
        doc.asset = { version: "2.0", generator: "updated" };
      }),
      name: "updated.glb",
    },
  );
  const old = await catalog.deliver(shop, "consumer", "https://app.example");
  assert.ok(old.models);
  assert.equal(old.models.find((m) => m.id === "TEST_MODULE")!.widthMm, 400);
  await assert.rejects(catalog.publish(shop, priorFingerprint), /已更新/);
  const release = await catalog.publish(shop, await fingerprint());
  assert.notEqual(release.id, firstRelease);
  const updated = await catalog.deliver(
    shop,
    "consumer",
    "https://app.example",
  );
  assert.ok(updated.models);
  assert.equal(
    updated.models.find((m) => m.id === "TEST_MODULE")!.widthMm,
    420,
  );
  await access(path.join(root, "models", before.fileKey));
  await catalog.rollback(shop, firstRelease);
  const restored = await catalog.deliver(
    shop,
    "consumer",
    "https://app.example",
  );
  assert.ok(restored.models);
  assert.equal(
    restored.models.find((m) => m.id === "TEST_MODULE")!.widthMm,
    400,
  );
  await assert.rejects(
    catalog.rollback("other.myshopify.com", firstRelease),
    /不存在/,
  );
});
test("publishing rejects dangling model references and cross-shop thumbnail references", async () => {
  const before = await db.modelDraft.findFirstOrThrow({
    where: { shop, modelId: "TEST_MODULE" },
  });
  const config = JSON.parse(before.configJson);
  config.render.dividerSourceId = "missing";
  await db.modelDraft.update({
    where: { id: before.id },
    data: { configJson: JSON.stringify(config) },
  });
  await assert.rejects(catalog.publish(shop, await fingerprint()), /隔板/);
  await db.modelDraft.update({
    where: { id: before.id },
    data: { configJson: before.configJson },
  });
  config.render.dividerSourceId = "";
  config.thumbnailAssetId = "00000000-0000-4000-8000-000000000099";
  const metadata = modelMetadataSchema.parse({
    ...emptyModelForm,
    modelId: "CROSS_SHOP",
    label: "test",
    widthMm: "10",
    depthMm: "10",
    heightMm: "10",
    configJson: JSON.stringify(config),
  });
  await assert.rejects(
    models.save(shop, metadata, null, { bytes: glb(), name: "test.glb" }),
    /缩略图/,
  );
});
