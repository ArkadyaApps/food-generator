import type { APIRoute } from "astro";
import { SiteFormSchema } from "@/lib/validations/site";
import { redeployRestaurantSite } from "@/lib/generator/redeploy";
import { db } from "@/lib/db";
import { sites } from "@/db/schema";
import { eq } from "drizzle-orm";

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  try {
    const body = await request.json() as { slug: string; data: unknown };
    const { slug } = body;

    if (!slug) return Response.json({ success: false, error: "slug required" }, { status: 400 });

    const data = SiteFormSchema.parse(body.data);
    const database = db(env.DB);

    const [site] = await database.select().from(sites).where(eq(sites.slug, slug));
    if (!site) return Response.json({ success: false, error: "Site not found" }, { status: 404 });

    await database.update(sites).set({ status: "deploying", updatedAt: new Date() }).where(eq(sites.slug, slug));

    try {
      await redeployRestaurantSite(slug, data, {
        GITHUB_TOKEN: env.GITHUB_TOKEN,
        GITHUB_OWNER: env.GITHUB_OWNER,
        CF_API_TOKEN: env.CF_API_TOKEN,
        SITE_URL: site.deployUrl ?? `https://${slug}.pages.dev`,
      });
    } catch (err) {
      await database.update(sites).set({ status: "error", updatedAt: new Date() }).where(eq(sites.slug, slug));
      throw err;
    }

    await database
      .update(sites)
      .set({ status: "live", formData: JSON.stringify(data), updatedAt: new Date() })
      .where(eq(sites.slug, slug));

    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
};
