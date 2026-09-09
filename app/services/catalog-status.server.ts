import db from "../db.server";
export async function publishedModelRevisions(
  shop: string,
): Promise<Record<string, number>> {
  const publication = await db.catalogPublication.findUnique({
    where: { shop },
  });
  if (!publication) return {};
  const release = await db.catalogRelease.findFirst({
    where: { shop, id: publication.releaseId },
    select: { json: true },
  });
  if (!release) return {};
  const models = (
    JSON.parse(release.json) as {
      models: Array<{ id: string; revision: number }>;
    }
  ).models;
  return Object.fromEntries(models.map((m) => [m.id, m.revision]));
}
