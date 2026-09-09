import { useState } from "react";
import type { AssetOption } from "./ConfigFields";
export function AssetUpload({
  onUploaded,
}: {
  onUploaded: (asset: AssetOption) => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="asset-upload">
      <label className="button file-picker">
        {busy ? "上传中…" : "上传缩略图 / 组合封面 / HDR"}
        <input
          aria-label="上传图片或环境文件"
          disabled={busy}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.hdr"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 20 * 1024 * 1024) {
              setMessage("文件最大 20 MB");
              return;
            }
            setBusy(true);
            setMessage("");
            const form = new FormData();
            form.set("file", file);
            try {
              const r = await fetch("/api/catalog-assets", {
                method: "POST",
                body: form,
              });
              const result = await r.json();
              if (!r.ok || !result.ok)
                throw new Error(result.message || "上传失败");
              onUploaded(result.asset);
              setMessage(`已上传 ${file.name}，请在对应图片选项中选择并保存。`);
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "上传失败");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {message && (
        <p role="status" className="hint">
          {message}
        </p>
      )}
    </div>
  );
}
