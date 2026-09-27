import { useState } from "react";
import { useFormContext } from "react-hook-form";
import type { SiteFormData } from "@/lib/validations/site";

interface Props {
  slug: string;
  onBack: () => void;
  onSuccess: () => void;
  deployUrl: string | null;
  githubRepo: string;
}

export default function StepRedeploy({ slug, onBack, onSuccess, deployUrl, githubRepo }: Props) {
  const { getValues } = useFormContext<SiteFormData>();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const data = getValues();

    try {
      const res = await fetch("/api/redeploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, data }),
      });
      const json = await res.json() as { success: boolean; error?: string };

      if (!json.success) {
        setError(json.error ?? "Save failed");
        setSaving(false);
        return;
      }

      setDone(true);
      setSaving(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setSaving(false);
    }
  }

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ marginBottom: "1.75rem" }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 4 }}>
          Step 7 of 7
        </p>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#111827" }}>Save & Redeploy</h2>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Your changes will be committed to GitHub and the site will rebuild automatically (~2 min).
        </p>
      </div>

      {!done && (
        <div style={{ padding: "1rem 1.25rem", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, marginBottom: "1.5rem", fontSize: 13, color: "#6b7280" }}>
          <p style={{ marginBottom: 8 }}>The following files will be updated in <strong style={{ color: "#111827" }}>{slug}</strong>:</p>
          <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
            <li><code>src/config/site.ts</code> — restaurant settings &amp; coordinates</li>
            <li><code>src/i18n/en.json</code> — content &amp; translations</li>
            <li>Menu photos (if updated)</li>
            <li><code>.github/workflows/deploy.yml</code> &amp; <code>astro.config.mjs</code> — synced to the current generator, so this site's CI stays consistent with every other site</li>
          </ul>
        </div>
      )}

      {done && (
        <div style={{ padding: "1.25rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, marginBottom: "1.5rem" }}>
          <p style={{ fontWeight: 600, color: "#166534", fontSize: 15 }}>Changes saved!</p>
          <p style={{ fontSize: 13, color: "#16a34a", marginTop: 4 }}>
            GitHub Actions is rebuilding the site. Changes should be live in ~2 minutes.
          </p>
          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            {deployUrl && (
              <a href={deployUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#15803d", fontWeight: 500 }}>
                View live site →
              </a>
            )}
            <a href={`${githubRepo}/actions`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#6b7280" }}>
              Watch build →
            </a>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: "1rem 1.25rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, marginBottom: "1.5rem" }}>
          <p style={{ fontWeight: 600, color: "#991b1b", marginBottom: 4 }}>Save failed</p>
          <p style={{ fontSize: 13, color: "#dc2626", fontFamily: "monospace", wordBreak: "break-word" }}>{error}</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, paddingTop: "1.5rem", borderTop: "1px solid #f3f4f6" }}>
        {!done && (
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            style={{ padding: "9px 20px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 14, fontWeight: 500, color: saving ? "#d1d5db" : "#6b7280", background: "white", cursor: saving ? "not-allowed" : "pointer" }}
          >
            ← Back
          </button>
        )}

        {!done && (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{ marginLeft: "auto", padding: "9px 28px", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "white", background: saving ? "#9ca3af" : "#111827", cursor: saving ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            {saving ? (
              <>
                <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Saving…
              </>
            ) : error ? "Retry" : "Save & Redeploy →"}
          </button>
        )}

        {done && (
          <a
            href={`/sites/${slug}`}
            style={{ padding: "9px 24px", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, color: "white", background: "#111827", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            Back to site details →
          </a>
        )}
      </div>
    </div>
  );
}
