import type { z } from "zod";
import type { modelMetadataSchema } from "../services/model-metadata.server";

export const MAX_GLB_BYTES = 25 * 1024 * 1024;
export const MAX_REQUEST_BYTES = MAX_GLB_BYTES + 64 * 1024;

export type ModelMetadata = z.output<typeof modelMetadataSchema>;
export type ModelFormValues = z.input<typeof modelMetadataSchema>;
export type FieldErrors = Partial<
  Record<keyof ModelFormValues | "file", string[]>
>;
export type SaveResult =
  | { ok: true; id: string; revision: number }
  | { ok: false; message: string; errors?: FieldErrors };

export const emptyModelForm: ModelFormValues = {
  label: "",
  shortLabel: "",
  catalogCode: "",
  note: "",
  widthMm: "",
  depthMm: "",
  heightMm: "",
  frontWidthMm: "",
  gridWidth: "1",
  gridHeight: "1",
  placement: "grid",
  placementYOffsetMm: "0",
  supportsMarineBoardColor: "false",
  previewTransform: "scene",
};

export function formatFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
