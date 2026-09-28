import { seal } from "tweetnacl-sealedbox-js";

const GITHUB_API = "https://api.github.com";

function ghHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "food-generator/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
    ...extra,
  };
}

export async function createRepoFromTemplate(
  token: string,
  owner: string,
  templateRepo: string,
  newRepoName: string,
  newOwner: string
): Promise<{ html_url: string; clone_url: string }> {
  // Check if repo already exists (previous failed attempt)
  const existingRes = await fetch(`${GITHUB_API}/repos/${newOwner}/${newRepoName}`, {
    headers: ghHeaders(token),
  });
  if (existingRes.ok) {
    return existingRes.json() as Promise<{ html_url: string; clone_url: string }>;
  }

  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${templateRepo}/generate`,
    {
      method: "POST",
      headers: ghHeaders(token),
      body: JSON.stringify({
        owner: newOwner,
        name: newRepoName,
        private: false,
        include_all_branches: false,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub create repo failed: ${err}`);
  }
  return res.json() as Promise<{ html_url: string; clone_url: string }>;
}

export async function getDefaultBranch(
  token: string,
  owner: string,
  repo: string
): Promise<string> {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: ghHeaders(token),
  });
  const data = (await res.json()) as { default_branch: string };
  return data.default_branch ?? "main";
}

export async function getFileSha(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<string | undefined> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
    { headers: ghHeaders(token) }
  );
  if (!res.ok) return undefined;
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

export async function commitFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  sha?: string
): Promise<void> {
  const body: Record<string, unknown> = { message, content, branch };
  if (sha) body.sha = sha;

  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: ghHeaders(token),
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub commit failed for ${path}: ${err}`);
  }
}

export async function addRepoVariable(
  token: string,
  owner: string,
  repo: string,
  name: string,
  value: string
): Promise<void> {
  const createRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/variables`,
    {
      method: "POST",
      headers: ghHeaders(token),
      body: JSON.stringify({ name, value }),
    }
  );

  if (!createRes.ok) {
    await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/actions/variables/${name}`,
      {
        method: "PATCH",
        headers: ghHeaders(token),
        body: JSON.stringify({ name, value }),
      }
    );
  }
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function addRepoSecret(
  token: string,
  owner: string,
  repo: string,
  name: string,
  value: string
): Promise<void> {
  const keyRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/secrets/public-key`,
    { headers: ghHeaders(token) }
  );
  if (!keyRes.ok) {
    throw new Error(`GitHub public key fetch failed: ${await keyRes.text()}`);
  }
  const { key_id, key } = (await keyRes.json()) as { key_id: string; key: string };
  const encrypted = seal(new TextEncoder().encode(value), b64ToBytes(key));

  const putRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/secrets/${name}`,
    {
      method: "PUT",
      headers: ghHeaders(token),
      body: JSON.stringify({ encrypted_value: bytesToB64(encrypted), key_id }),
    }
  );
  if (!putRes.ok) {
    throw new Error(`GitHub secret ${name} failed: ${await putRes.text()}`);
  }
}

export async function deleteRepoVariable(
  token: string,
  owner: string,
  repo: string,
  name: string
): Promise<void> {
  await fetch(`${GITHUB_API}/repos/${owner}/${repo}/actions/variables/${name}`, {
    method: "DELETE",
    headers: ghHeaders(token),
  });
}
