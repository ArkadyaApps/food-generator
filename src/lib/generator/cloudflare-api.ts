const CF_API = "https://api.cloudflare.com/client/v4";

function cfHeaders(apiToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };
}

export async function createD1Database(
  apiToken: string,
  accountId: string,
  name: string
): Promise<{ uuid: string }> {
  const res = await fetch(`${CF_API}/accounts/${accountId}/d1/database`, {
    method: "POST",
    headers: cfHeaders(apiToken),
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const err = await res.text();
    // 409 = already exists — fetch the existing one
    if (res.status === 409) {
      const listRes = await fetch(
        `${CF_API}/accounts/${accountId}/d1/database?name=${encodeURIComponent(name)}`,
        { headers: cfHeaders(apiToken) }
      );
      const listData = (await listRes.json()) as { result: { uuid: string }[] };
      const existing = listData.result?.[0];
      if (existing) return { uuid: existing.uuid };
    }
    throw new Error(`D1 create failed: ${err}`);
  }

  const data = (await res.json()) as { result: { uuid: string } };
  return { uuid: data.result.uuid };
}

export async function applyD1Migration(
  apiToken: string,
  accountId: string,
  databaseId: string,
  sql: string
): Promise<void> {
  const res = await fetch(
    `${CF_API}/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: cfHeaders(apiToken),
      body: JSON.stringify({ sql }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`D1 migration failed: ${err}`);
  }
}

async function getPagesSubdomain(
  apiToken: string,
  accountId: string,
  projectName: string
): Promise<string> {
  const res = await fetch(`${CF_API}/accounts/${accountId}/pages/projects/${projectName}`, {
    headers: cfHeaders(apiToken),
  });
  const data = (await res.json()) as { result?: { subdomain?: string } };
  return data.result?.subdomain ?? `${projectName}.pages.dev`;
}

async function createPagesProject(
  apiToken: string,
  accountId: string,
  projectName: string,
  productionBranch: string
): Promise<{ subdomain: string; created: boolean }> {
  const res = await fetch(`${CF_API}/accounts/${accountId}/pages/projects`, {
    method: "POST",
    headers: cfHeaders(apiToken),
    body: JSON.stringify({
      name: projectName,
      production_branch: productionBranch,
    }),
  });

  if (res.status === 409) {
    return { subdomain: await getPagesSubdomain(apiToken, accountId, projectName), created: false };
  }
  if (!res.ok) {
    throw new Error(`CF Pages project creation failed: ${await res.text()}`);
  }
  const data = (await res.json()) as { result?: { subdomain: string } };
  return { subdomain: data.result?.subdomain ?? `${projectName}.pages.dev`, created: true };
}

async function deletePagesProject(
  apiToken: string,
  accountId: string,
  projectName: string
): Promise<void> {
  await fetch(`${CF_API}/accounts/${accountId}/pages/projects/${projectName}`, {
    method: "DELETE",
    headers: cfHeaders(apiToken),
  });
}

/**
 * Cloudflare appends a random suffix to the *.pages.dev address when the plain
 * name is already taken by any account. A project's address cannot be changed
 * afterwards, so try a few close variants of the name and keep the first one
 * that gets a clean address. Only projects created by this call are ever deleted.
 */
export async function createFriendlyPagesProject(
  apiToken: string,
  accountId: string,
  slug: string,
  productionBranch: string
): Promise<{ name: string; subdomain: string }> {
  const candidates = [slug, `${slug}-site`, `${slug}-web`, `${slug}-resto`, `${slug}-eat`].filter(
    (n) => n.length <= 58
  );

  for (const name of candidates) {
    const { subdomain, created } = await createPagesProject(apiToken, accountId, name, productionBranch);
    if (subdomain === `${name}.pages.dev` || !created) {
      return { name, subdomain };
    }
    await deletePagesProject(apiToken, accountId, name);
  }

  const { subdomain } = await createPagesProject(apiToken, accountId, slug, productionBranch);
  return { name: slug, subdomain };
}
