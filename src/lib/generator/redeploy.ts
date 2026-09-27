import type { SiteFormData } from "@/lib/validations/site";
import {
  generateSiteConfig,
  generateEnJson,
  generateFrJson,
  generateThJson,
  generateLogoSvg,
  generateWorkflow,
  generateAstroConfig,
} from "./template";
import { THEMES } from "@/lib/themes";
import { commitFile, getFileSha, getDefaultBranch } from "./github";

function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function redeployRestaurantSite(
  slug: string,
  data: SiteFormData,
  env: {
    GITHUB_TOKEN: string;
    GITHUB_OWNER: string;
  }
): Promise<void> {
  const branch = await getDefaultBranch(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug);

  // Keep deploy infrastructure in sync with the current generator on every
  // redeploy — sites created at different times otherwise freeze whatever
  // workflow.yml/astro.config.mjs existed at their creation date and drift
  // out of consistency (e.g. one site stuck on an older Node version or
  // missing a CI step a newer one has).
  const workflowContent = generateWorkflow(branch);
  const workflowSha = await getFileSha(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, ".github/workflows/deploy.yml");
  await commitFile(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, ".github/workflows/deploy.yml", toBase64(workflowContent), "chore: sync deploy workflow with generator", branch, workflowSha);

  const astroConfigContent = generateAstroConfig(data);
  const astroConfigSha = await getFileSha(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, "astro.config.mjs");
  await commitFile(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, "astro.config.mjs", toBase64(astroConfigContent), "chore: sync astro config with generator", branch, astroConfigSha);

  // Update site config
  const siteConfigContent = generateSiteConfig(data);
  const siteConfigSha = await getFileSha(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, "src/config/site.ts");
  await commitFile(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, "src/config/site.ts", toBase64(siteConfigContent), "content: update restaurant configuration", branch, siteConfigSha);

  // Update i18n files
  const enJson = generateEnJson(data);
  const enSha = await getFileSha(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, "src/i18n/en.json");
  await commitFile(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, "src/i18n/en.json", toBase64(enJson), "content: update translations", branch, enSha);

  const frJson = generateFrJson(data);
  const frSha = await getFileSha(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, "src/i18n/fr.json");
  await commitFile(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, "src/i18n/fr.json", toBase64(frJson), "content: update FR translations", branch, frSha);

  const thJson = generateThJson(data);
  const thSha = await getFileSha(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, "src/i18n/th.json");
  await commitFile(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, "src/i18n/th.json", toBase64(thJson), "content: update TH translations", branch, thSha);

  // Upload logo (uploaded or auto-generated SVG)
  const theme = THEMES.find((t) => t.id === data.theme);
  const accentColor = theme?.preview.accent ?? "#374151";
  const logoExt = data.logo
    ? (data.logo.mimeType === "image/svg+xml" ? "svg" : data.logo.mimeType.split("/")[1] || "png")
    : "svg";
  const logoPath = `public/images/logo.${logoExt}`;
  const logoContent = data.logo
    ? data.logo.data
    : toBase64(generateLogoSvg(data.name, accentColor));
  const logoSha = await getFileSha(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, logoPath);
  await commitFile(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, logoPath, logoContent, "content: update restaurant logo", branch, logoSha);

  // Upload any new photos
  for (let i = 0; i < data.photos.length; i++) {
    const photo = data.photos[i];
    const ext = photo.mimeType.split("/")[1] || "jpeg";
    const path = `public/images/menu${i + 1}.${ext}`;
    const existingSha = await getFileSha(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, path);
    await commitFile(env.GITHUB_TOKEN, env.GITHUB_OWNER, slug, path, photo.data, `content: update menu photo ${i + 1}`, branch, existingSha);
  }
}
