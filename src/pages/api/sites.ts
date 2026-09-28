import type { APIRoute } from "astro";
import { SiteFormSchema } from "@/lib/validations/site";
import { deployRestaurantSite } from "@/lib/generator/deploy";
import { db } from "@/lib/db";
import { sites } from "@/db/schema";
import { eq } from "drizzle-orm";

export const GET: APIRoute = async ({ locals }) => {
  const database = db(locals.runtime.env.DB);
  const allSites = await database
    .select()
    .from(sites)
    .orderBy(sites.createdAt);
  return Response.json(allSites);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  try {
    const body = await request.json();
    const data = SiteFormSchema.parse(body);

    const database = db(env.DB);

    // If a previous failed attempt exists for this slug, delete it and retry
    await database.delete(sites).where(eq(sites.slug, data.slug));

    const id = crypto.randomUUID();
    await database.insert(sites).values({
      id,
      name: data.name,
      slug: data.slug,
      githubRepo: `https://github.com/${env.GITHUB_OWNER}/${data.slug}`,
      cfProjectName: data.slug,
      status: "deploying",
      theme: data.theme,
      formData: JSON.stringify(data),
    });

    // Deploy inline (CF Workers have 30s CPU limit but wall-clock can be longer with subrequests)
    let result;
    try {
      result = await deployRestaurantSite(data, {
        GITHUB_TOKEN: env.GITHUB_TOKEN,
        GITHUB_OWNER: env.GITHUB_OWNER,
        TEMPLATE_REPO: env.TEMPLATE_REPO,
        CF_API_TOKEN: env.CF_API_TOKEN,
        CF_ACCOUNT_ID: env.CF_ACCOUNT_ID,
      });
    } catch (deployErr) {
      // Mark as error in DB
      await database
        .update(sites)
        .set({ status: "error", updatedAt: new Date() })
        .where(eq(sites.id, id));
      throw deployErr;
    }

    // Update record with result
    await database
      .update(sites)
      .set({
        status: "live",
        deployUrl: result.pagesUrl,
        cfProjectName: result.cfProjectName,
        updatedAt: new Date(),
      })
      .where(eq(sites.id, id));

    return Response.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
};
