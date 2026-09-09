import { z } from "zod";
export const viewerSchema = z
  .object({
    VIEWER_GRID_SIZE_M: z.number().finite().positive().max(200),
    VIEWER_GRID_DIVISIONS: z.number().int().min(1).max(512),
    VIEWER_FLOOR_SIZE_M: z.number().finite().positive().max(200),
    VIEWER_GRID_MAJOR_EVERY: z.number().finite().positive().max(200),
    VIEWER_GRID_MEDIUM_EVERY: z.number().finite().positive().max(200),
    VIEWER_GRID_CROSS_ARMS_M: z.tuple([
      z.number().finite().positive().max(200),
      z.number().finite().positive().max(200),
      z.number().finite().positive().max(200),
    ]),
    VIEWER_GRID_CENTER_DASHES_M: z.tuple([
      z.number().finite().positive().max(200),
      z.number().finite().positive().max(200),
      z.number().finite().positive().max(200),
    ]),
    VIEWER_GRID_POINTER_RADIUS_M: z.number().finite().positive().max(200),
    VIEWER_FOG_NEAR_M: z.number().finite().positive().max(200),
    VIEWER_FOG_FAR_M: z.number().finite().positive().max(200),
    VIEWER_GRID_PALETTES: z
      .object({
        light: z.tuple([
          z.number().int().min(0).max(16777215),
          z.number().int().min(0).max(16777215),
          z.number().int().min(0).max(16777215),
        ]),
        dark: z.tuple([
          z.number().int().min(0).max(16777215),
          z.number().int().min(0).max(16777215),
          z.number().int().min(0).max(16777215),
        ]),
      })
      .strict(),
    LIGHTING_PROFILES: z
      .object({
        light: z
          .object({
            exposure: z.number().finite().positive().max(200),
            environment: z.number().finite().positive().max(200),
            hemisphere: z.number().finite().positive().max(200),
            key: z.number().finite().positive().max(200),
            rim: z.number().finite().positive().max(200),
            sky: z.number().int().min(0).max(16777215),
            ground: z.number().int().min(0).max(16777215),
            keyColor: z.number().int().min(0).max(16777215),
            rimColor: z.number().int().min(0).max(16777215),
          })
          .strict(),
        dark: z
          .object({
            exposure: z.number().finite().positive().max(200),
            environment: z.number().finite().positive().max(200),
            hemisphere: z.number().finite().positive().max(200),
            key: z.number().finite().positive().max(200),
            rim: z.number().finite().positive().max(200),
            sky: z.number().int().min(0).max(16777215),
            ground: z.number().int().min(0).max(16777215),
            keyColor: z.number().int().min(0).max(16777215),
            rimColor: z.number().int().min(0).max(16777215),
          })
          .strict(),
        blackRender: z
          .object({
            exposure: z.number().finite().positive().max(200),
            environment: z.number().finite().positive().max(200),
            hemisphere: z.number().finite().positive().max(200),
            key: z.number().finite().positive().max(200),
            rim: z.number().finite().positive().max(200),
            sky: z.number().int().min(0).max(16777215),
            ground: z.number().int().min(0).max(16777215),
            keyColor: z.number().int().min(0).max(16777215),
            rimColor: z.number().int().min(0).max(16777215),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
