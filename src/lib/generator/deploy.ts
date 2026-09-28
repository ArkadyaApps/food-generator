import type { SiteFormData } from "@/lib/validations/site";
import {
  generateSiteConfig,
  generateWranglerToml,
  generateEnJson,
  generateFrJson,
  generateThJson,
  generateWorkflow,
  generateLogoSvg,
  generateAstroConfig,
} from "./template";
import { THEMES } from "@/lib/themes";
import {
  createRepoFromTemplate,
  commitFile,
  getFileSha,
  getDefaultBranch,
  addRepoVariable,
  addRepoSecret,
  deleteRepoVariable,
} from "./github";
import { createPagesProject, createD1Database, applyD1Migration } from "./cloudflare-api";

function toBase64(str: string): string {
  // Use TextEncoder for proper UTF-8 handling in CF Workers
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export interface DeployResult {
  repoUrl: string;
  pagesUrl: string;
  cfProjectName: string;
}

export async function deployRestaurantSite(
  data: SiteFormData,
  env: {
    GITHUB_TOKEN: string;
    GITHUB_OWNER: string;
    TEMPLATE_REPO: string;
    CF_API_TOKEN: string;
    CF_ACCOUNT_ID: string;
  }
): Promise<DeployResult> {
  const repoName = data.slug;
  const cfProjectName = data.slug;

  // 1. Create GitHub repo from template
  const repo = await createRepoFromTemplate(
    env.GITHUB_TOKEN,
    env.GITHUB_OWNER,
    env.TEMPLATE_REPO,
    repoName,
    env.GITHUB_OWNER
  );

  // Wait for the repo to be ready, then detect actual default branch
  await new Promise((r) => setTimeout(r, 3000));
  const branch = await getDefaultBranch(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName);

  // 2. Commit customized src/config/site.ts
  const siteConfigContent = generateSiteConfig(data);
  const siteConfigSha = await getFileSha(
    env.GITHUB_TOKEN,
    env.GITHUB_OWNER,
    repoName,
    "src/config/site.ts"
  );
  await commitFile(
    env.GITHUB_TOKEN,
    env.GITHUB_OWNER,
    repoName,
    "src/config/site.ts",
    toBase64(siteConfigContent),
    "chore: configure restaurant site",
    branch,
    siteConfigSha
  );

  // 3. Commit customized i18n files
  const enJson = generateEnJson(data);

  const enSha = await getFileSha(
    env.GITHUB_TOKEN,
    env.GITHUB_OWNER,
    repoName,
    "src/i18n/en.json"
  );
  await commitFile(
    env.GITHUB_TOKEN,
    env.GITHUB_OWNER,
    repoName,
    "src/i18n/en.json",
    toBase64(enJson),
    "content: add restaurant translations",
    branch,
    enSha
  );

  const frJson = generateFrJson(data);
  const frSha = await getFileSha(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, "src/i18n/fr.json");
  await commitFile(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, "src/i18n/fr.json", toBase64(frJson), "content: add FR translations", branch, frSha);

  const thJson = generateThJson(data);
  const thSha = await getFileSha(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, "src/i18n/th.json");
  await commitFile(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, "src/i18n/th.json", toBase64(thJson), "content: add TH translations", branch, thSha);

  // 4. Commit photos
  for (let i = 0; i < data.photos.length; i++) {
    const photo = data.photos[i];
    const ext = photo.mimeType.split("/")[1] || "jpeg";
    const path = `public/images/menu${i + 1}.${ext}`;
    const existingSha = await getFileSha(
      env.GITHUB_TOKEN,
      env.GITHUB_OWNER,
      repoName,
      path
    );
    await commitFile(
      env.GITHUB_TOKEN,
      env.GITHUB_OWNER,
      repoName,
      path,
      photo.data, // already base64
      `content: add menu photo ${i + 1}`,
      branch,
      existingSha
    );
  }

  // 5. Commit logo (uploaded or auto-generated SVG)
  const theme = THEMES.find((t) => t.id === data.theme);
  const accentColor = theme?.preview.accent ?? "#374151";
  const logoExt = data.logo
    ? (data.logo.mimeType === "image/svg+xml" ? "svg" : data.logo.mimeType.split("/")[1] || "png")
    : "svg";
  const logoPath = `public/images/logo.${logoExt}`;
  const logoContent = data.logo
    ? data.logo.data
    : toBase64(generateLogoSvg(data.name, accentColor));
  const logoSha = await getFileSha(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, logoPath);
  await commitFile(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, logoPath, logoContent, "content: add restaurant logo", branch, logoSha);

  // 6. Create D1 database + apply migration
  const dbName = `${data.slug}-db`;
  const { uuid: d1Uuid } = await createD1Database(env.CF_API_TOKEN, env.CF_ACCOUNT_ID, dbName);
  const migrationSql = `CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    party_size INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    notes TEXT,
    locale TEXT NOT NULL DEFAULT 'en',
    created_at INTEGER NOT NULL
  );`;
  await applyD1Migration(env.CF_API_TOKEN, env.CF_ACCOUNT_ID, d1Uuid, migrationSql);

  // Commit customized wrangler.toml with real D1 UUID
  const wranglerContent = generateWranglerToml(data, d1Uuid);
  const wranglerSha = await getFileSha(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, "wrangler.toml");
  await commitFile(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, "wrangler.toml", toBase64(wranglerContent), "chore: configure wrangler", branch, wranglerSha);

  // 6. Overwrite workflow with correct branch + vars (not secrets)
  const workflowContent = generateWorkflow(branch);
  const workflowSha = await getFileSha(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, ".github/workflows/deploy.yml");
  await commitFile(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, ".github/workflows/deploy.yml", toBase64(workflowContent), "chore: configure deployment workflow", branch, workflowSha);

  // Set the real deployed URL so canonical tags, sitemap, robots.txt and the
  // OG-image QR code all point at the live site instead of the template placeholder.
  const astroConfigContent = generateAstroConfig(data);
  const astroConfigSha = await getFileSha(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, "astro.config.mjs");
  await commitFile(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, "astro.config.mjs", toBase64(astroConfigContent), "chore: set live site URL for SEO tags", branch, astroConfigSha);

  // 7. Create CF Pages project (production_branch must match actual git branch)
  const { subdomain } = await createPagesProject(
    env.CF_API_TOKEN,
    env.CF_ACCOUNT_ID,
    cfProjectName,
    branch
  );

  // 8. Set GitHub Actions config: token as an encrypted secret, non-sensitive values as variables
  await addRepoVariable(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, "CF_PROJECT_NAME", cfProjectName);
  await addRepoVariable(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, "CF_ACCOUNT_ID", env.CF_ACCOUNT_ID);
  await addRepoSecret(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, "CF_API_TOKEN", env.CF_API_TOKEN);
  await deleteRepoVariable(env.GITHUB_TOKEN, env.GITHUB_OWNER, repoName, "CF_API_TOKEN");

  const pagesUrl = `https://${subdomain}`;

  return {
    repoUrl: repo.html_url,
    pagesUrl,
    cfProjectName,
  };
}
