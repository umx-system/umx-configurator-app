import { modelMetadataSchema } from "../app/services/model-metadata.server";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import {
  writeFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { emptyModelForm, MAX_REQUEST_BYTES } from "../app/lib/model-contract";
import { inspectGlb } from "../app/lib/glb";
import {
  validateGlb,
  readModelForm,
  DraftError,
} from "../app/services/model-upload.server";
import { createModelDraftService } from "../app/services/model-drafts.server";

// Synthetic triangle: no proprietary model assets enter the repository.
function glb(edit: (document: Record<string, unknown>) => void = () => {}) {
  const document: Record<string, unknown> = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
    bufferViews: [{ buffer: 0, byteLength: 36, target: 34962 }],
    buffers: [{ byteLength: 36 }],
  };
  edit(document);
  const json = Buffer.from(JSON.stringify(document));
  const padded = Math.ceil(json.byteLength / 4) * 4;
  const bytes = Buffer.alloc(12 + 8 + padded + 8 + 36);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(padded, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  bytes.fill(32, 20, 20 + padded);
  json.copy(bytes, 20);
  bytes.writeUInt32LE(36, 20 + padded);
  bytes.writeUInt32LE(0x004e4942, 24 + padded);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
    bytes.writeFloatLE(value, 28 + padded + index * 4),
  );
  return bytes;
}

const fields = {
  ...emptyModelForm,
  label: "测试模块",
  catalogCode: "test_01",
  widthMm: "400",
  depthMm: "423.7662",
  heightMm: "198",
};
const metadata = modelMetadataSchema.parse(fields);
const upload = { bytes: glb(), name: "../../test.glb" };
let directory: string;
let db: PrismaClient;
let service: ReturnType<typeof createModelDraftService>;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "umx-model-tests-"));
  const databaseUrl = `file:${path.join(directory, "test.sqlite")}`;
  await writeFile(path.join(directory, "test.sqlite"), "");
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" },
  );
  db = new PrismaClient({ datasourceUrl: databaseUrl });
  service = createModelDraftService(db, path.join(directory, "models"));
});
after(async () => {
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("metadata preserves precision, normalizes code, rejects blank, negative and invalid grid values", () => {
  assert.equal(metadata.depthMm, 423.7662);
  assert.equal(metadata.catalogCode, "TEST_01");
  for (const override of [
    { widthMm: "" },
    { heightMm: "-1" },
    { widthMm: "Infinity" },
    { gridWidth: "1.5" },
    { gridHeight: "0" },
    { placement: "custom" },
    { catalogCode: "../bad" },
  ]) {
    assert.equal(
      modelMetadataSchema.safeParse({ ...fields, ...override }).success,
      false,
    );
  }
  assert.equal(
    modelMetadataSchema.parse({ ...fields, catalogCode: "" }).catalogCode,
    null,
  );
});

test("GLB preflight and full structural validation reject malformed or external content", async () => {
  await validateGlb(glb());
  assert.throws(() => inspectGlb(Buffer.from("not a model")));
  const truncated = glb().subarray(0, -4);
  assert.throws(() => inspectGlb(truncated), /不完整/);
  assert.throws(
    () =>
      inspectGlb(
        glb((doc) => {
          doc.images = [{ uri: "https://example.com/private.png" }];
        }),
      ),
    /嵌入/,
  );
  assert.throws(
    () =>
      inspectGlb(
        glb((doc) => {
          doc.images = [{ uri: "data:image/png;base64,AAA" }];
        }),
      ),
    /嵌入/,
  );
  assert.throws(
    () =>
      inspectGlb(
        glb((doc) => {
          doc.extensionsRequired = ["KHR_texture_basisu"];
        }),
      ),
    /暂不支持/,
  );
  await assert.rejects(
    validateGlb(
      glb((doc) => {
        doc.bufferViews = [{ buffer: 99, byteLength: 36 }];
      }),
    ),
    /结构校验失败/,
  );
});

test("multipart cap applies to declared and streamed bodies without content-length", async () => {
  await assert.rejects(
    readModelForm(
      new Request("https://app.test", {
        method: "POST",
        headers: {
          "content-type": "multipart/form-data; boundary=x",
          "content-length": String(MAX_REQUEST_BYTES + 1),
        },
        body: "x",
      }),
    ),
    (error: unknown) => error instanceof DraftError && error.status === 413,
  );
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(1024 * 1024));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readModelForm(
      new Request("https://app.test", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=x" },
        body: stream,
        duplex: "half",
      } as RequestInit),
    ),
    /25 MB/,
  );
  assert.equal(cancelled, true);
});

test("bounded multipart parser preserves fields and binary file", async () => {
  const form = new FormData();
  form.set("label", "测试模块");
  form.set("file", new File([glb()], "test.glb"));
  const parsed = await readModelForm(
    new Request("https://app.test", { method: "POST", body: form }),
  );
  assert.equal(parsed.get("label"), "测试模块");
  assert.deepEqual(
    new Uint8Array(await (parsed.get("file") as File).arrayBuffer()),
    new Uint8Array(glb()),
  );
});

test("save, reconnect, list and file reads preserve data with shop isolation", async () => {
  const saved = await service.save("shop-a.test", metadata, null, upload);
  assert.equal(saved.revision, 1);
  assert.equal(saved.fileName, "test.glb");
  assert.equal(saved.shortLabel, "测试模块");
  assert.equal(saved.depthMm, 423.7662);
  await db.$disconnect();
  assert.equal((await service.get("shop-a.test", saved.id)).label, "测试模块");
  assert.deepEqual(
    (await service.readFile("shop-a.test", saved.id)).bytes,
    glb(),
  );
  const [list, count] = await service.list("shop-a.test", "TEST_01");
  assert.equal(list[0].id, saved.id);
  assert.equal(count, 1);
  assert.equal((await service.list("shop-b.test"))[1], 0);
  for (const action of [
    () => service.get("shop-b.test", saved.id),
    () => service.readFile("shop-b.test", saved.id),
    () =>
      service.save(
        "shop-b.test",
        metadata,
        { id: saved.id, revision: 1 },
        null,
      ),
  ])
    await assert.rejects(
      action,
      (error: unknown) => error instanceof DraftError && error.status === 404,
    );
});

test("metadata-only edit retains file; replacement removes old file; stale edits fail", async () => {
  const first = await service.save("edit-shop.test", metadata, null, upload);
  const second = await service.save(
    "edit-shop.test",
    { ...metadata, heightMm: 413 },
    { id: first.id, revision: 1 },
    null,
  );
  assert.equal(second.fileKey, first.fileKey);
  assert.equal(second.revision, 2);
  const third = await service.save(
    "edit-shop.test",
    {
      ...metadata,
      placement: "top",
      frontWidthMm: 400,
      placementYOffsetMm: 6.2,
    },
    { id: first.id, revision: 2 },
    { ...upload, name: "replacement.glb" },
  );
  assert.notEqual(third.fileKey, first.fileKey);
  assert.equal(third.revision, 3);
  assert.equal(third.placementYOffsetMm, 6.2);
  await assert.rejects(access(path.join(directory, "models", first.fileKey)));
  const filesBefore = await readdir(path.join(directory, "models"));
  await assert.rejects(
    service.save(
      "edit-shop.test",
      metadata,
      { id: first.id, revision: 2 },
      upload,
    ),
    (error: unknown) => error instanceof DraftError && error.status === 409,
  );
  assert.deepEqual(await readdir(path.join(directory, "models")), filesBefore);
});

test("duplicate code rolls back file writes; same code in another shop is allowed", async () => {
  await service.save("unique-shop.test", metadata, null, upload);
  const before = (await readdir(path.join(directory, "models"))).sort();
  await assert.rejects(
    service.save("unique-shop.test", metadata, null, upload),
    /编码已存在/,
  );
  assert.deepEqual(
    (await readdir(path.join(directory, "models"))).sort(),
    before,
  );
  await service.save("other-unique-shop.test", metadata, null, upload);
});

test("concurrent replacements cannot overwrite a newer revision or retain losing files", async () => {
  const first = await service.save("race-shop.test", metadata, null, upload);
  const before = (await readdir(path.join(directory, "models"))).length;
  const results = await Promise.allSettled(
    ["one.glb", "two.glb"].map((name) =>
      service.save(
        "race-shop.test",
        metadata,
        { id: first.id, revision: 1 },
        { ...upload, name },
      ),
    ),
  );
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal((await service.get("race-shop.test", first.id)).revision, 2);
  assert.equal((await readdir(path.join(directory, "models"))).length, before);
});

test("invalid replacement leaves saved metadata and bytes intact", async () => {
  const first = await service.save("invalid-shop.test", metadata, null, upload);
  await assert.rejects(
    service.save(
      "invalid-shop.test",
      { ...metadata, label: "bad" },
      { id: first.id, revision: 1 },
      { name: "bad.glb", bytes: Buffer.from("garbage") },
    ),
  );
  assert.equal(
    (await service.get("invalid-shop.test", first.id)).label,
    metadata.label,
  );
  assert.deepEqual(
    await readFile(path.join(directory, "models", first.fileKey)),
    glb(),
  );
  await assert.rejects(
    service.save("empty-shop.test", metadata, null, null),
    /选择 GLB/,
  );
});
