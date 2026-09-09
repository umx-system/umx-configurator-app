// Synthetic triangle: no proprietary model assets enter the repository.
export function glb(edit: (document: Record<string, unknown>) => void = () => {}) {
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
