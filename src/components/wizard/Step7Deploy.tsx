import { useState } from "react";
import { useFormContext } from "react-hook-form";
import type { SiteFormData } from "@/lib/validations/site";
import { THEMES } from "@/lib/themes";
import { StepHeader } from "./shared";

export interface DeploySuccess {
  repoUrl: string;
  pagesUrl: string;
}

interface Props {
  onBack: () => void;
  onSuccess: (result: DeploySuccess) => void;
  stepNumber?: number;
  totalSteps?: number;
}

type StatusStep = {
  label: string;
  status: "pending" | "running" | "done" | "error";
};

const PIPELINE_STEPS = [
  "Creating GitHub repository from template…",
  "Committing restaurant configuration…",
  "Committing i18n translations…",
  "Uploading menu photos…",
  "Configuring wrangler.toml…",
  "Creating Cloudflare Pages project…",
  "Setting repository variables…",
];

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid #f3f4f6",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#9ca3af", width: 140, flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ color: "#374151", fontWeight: 500, wordBreak: "break-word" }}>
        {value}
      </span>
    </div>
  );
}

interface CollapsibleProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Collapsible({ title, children, defaultOpen = false }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#f9fafb",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          color: "#374151",
          textAlign: "left",
        }}
      >
        {title}
        <span style={{ fontSize: 12, color: "#9ca3af" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div style={{ padding: "4px 14px 10px" }}>{children}</div>
      )}
    </div>
  );
}

export default function Step7Deploy({ onBack, onSuccess, stepNumber = 7, totalSteps = 7 }: Props) {
  const { getValues } = useFormContext<SiteFormData>();
  const data = getValues();
  const theme = THEMES.find((t) => t.id === data.theme);

  const [deploying, setDeploying] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<StatusStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Count open days
  const openDays = Object.entries(data.hours)
    .filter(([, v]) => v !== null)
    .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1, 3))
    .join(", ");

  async function deploy() {
    setDeploying(true);
    setError(null);
    setDone(false);

    // Show animated pipeline steps
    const steps: StatusStep[] = PIPELINE_STEPS.map((label) => ({
      label,
      status: "pending",
    }));
    setPipelineSteps([...steps]);

    // Animate first step immediately
    steps[0] = { ...steps[0], status: "running" };
    setPipelineSteps([...steps]);

    // Simulate step transitions while the actual API call runs
    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < steps.length - 1) {
        steps[stepIndex] = { ...steps[stepIndex], status: "done" };
        stepIndex++;
        steps[stepIndex] = { ...steps[stepIndex], status: "running" };
        setPipelineSteps([...steps]);
      }
    }, 2500);

    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      clearInterval(interval);

      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        repoUrl?: string;
        pagesUrl?: string;
      };

      if (!json.success) {
        // Mark last running step as error
        const errSteps = steps.map((s) =>
          s.status === "running" ? { ...s, status: "error" as const } : s
        );
        setPipelineSteps(errSteps);
        setError(json.error ?? "Deployment failed");
        setDeploying(false);
        return;
      }

      // All done
      const doneSteps = steps.map((s) => ({ ...s, status: "done" as const }));
      setPipelineSteps(doneSteps);
      setDone(true);
      setDeploying(false);

      if (json.repoUrl && json.pagesUrl) {
        onSuccess({ repoUrl: json.repoUrl, pagesUrl: json.pagesUrl });
      }
    } catch (err) {
      clearInterval(interval);
      const message =
        err instanceof Error ? err.message : "Network error";
      const errSteps = steps.map((s) =>
        s.status === "running" ? { ...s, status: "error" as const } : s
      );
      setPipelineSteps(errSteps);
      setError(message);
      setDeploying(false);
    }
  }

  const statusIcon = (s: StatusStep["status"]) => {
    if (s === "done")
      return (
        <span style={{ color: "#16a34a", fontSize: 14, lineHeight: 1 }}>
          ✓
        </span>
      );
    if (s === "error")
      return (
        <span style={{ color: "#dc2626", fontSize: 14, lineHeight: 1 }}>
          ✕
        </span>
      );
    if (s === "running")
      return (
        <span
          style={{
            display: "inline-block",
            width: 12,
            height: 12,
            border: "2px solid #111827",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      );
    return (
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#e5e7eb",
        }}
      />
    );
  };

  return (
    <div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <StepHeader
        step={stepNumber}
        title="Review & Deploy"
        subtitle={`Step ${stepNumber} of ${totalSteps} · Confirm the details, then deploy. This creates a GitHub repo and Cloudflare Pages project.`}
      />

      {/* Summary */}
      {!deploying && !done && (
        <div style={{ marginBottom: "1.5rem" }}>
          <Collapsible title="Basic Info" defaultOpen>
            <SummaryRow label="Name" value={data.name} />
            <SummaryRow label="Slug" value={data.slug} />
            <SummaryRow label="Tagline" value={data.tagline} />
            <SummaryRow label="Location" value={data.locationEyebrow} />
            <SummaryRow label="Timezone" value={data.timezone} />
            <SummaryRow label="Default locale" value={data.defaultLocale} />
          </Collapsible>

          <Collapsible title="Contact">
            <SummaryRow label="WhatsApp" value={data.whatsappDisplay} />
            <SummaryRow label={data.socialType !== "none" ? data.socialType : "Social"} value={data.socialHandle} />
            <SummaryRow
              label="Coordinates"
              value={`${data.mapsLat}, ${data.mapsLng}`}
            />
            <SummaryRow label="Address" value={data.address} />
          </Collapsible>

          <Collapsible title="Hours">
            <SummaryRow
              label="Open days"
              value={openDays || "None set"}
            />
          </Collapsible>

          <Collapsible title="Content">
            <SummaryRow label="Hero title" value={data.heroTitle} />
            <SummaryRow label="Hero subtitle" value={data.heroSubtitle} />
            <SummaryRow label="Menu intro" value={data.menuIntro} />
            <SummaryRow label="Footer tagline" value={data.footerTagline} />
            <SummaryRow
              label="Hours summary"
              value={data.footerHoursShort}
            />
          </Collapsible>

          <Collapsible title="Photos & Theme">
            <SummaryRow
              label="Photos"
              value={`${data.photos.length} photo${data.photos.length !== 1 ? "s" : ""} uploaded`}
            />
            <SummaryRow label="Theme" value={theme?.name} />
            <SummaryRow
              label="Fonts"
              value={
                theme
                  ? `${theme.fonts.display.replace(/'/g, "").split(",")[0]} / ${theme.fonts.body.replace(/'/g, "").split(",")[0]}`
                  : undefined
              }
            />
          </Collapsible>
        </div>
      )}

      {/* Pipeline steps */}
      {pipelineSteps.length > 0 && (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            background: "#fafafa",
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#6b7280",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Deployment pipeline
          </p>
          {pipelineSteps.map((step, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 0",
                opacity: step.status === "pending" ? 0.4 : 1,
                transition: "opacity 0.3s",
              }}
            >
              <div
                style={{
                  width: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {statusIcon(step.status)}
              </div>
              <span
                style={{
                  fontSize: 13,
                  color:
                    step.status === "error"
                      ? "#dc2626"
                      : step.status === "done"
                      ? "#374151"
                      : step.status === "running"
                      ? "#111827"
                      : "#9ca3af",
                  fontWeight: step.status === "running" ? 500 : 400,
                }}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Success state */}
      {done && (
        <div
          style={{
            padding: "1.25rem",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 10,
            marginBottom: "1.5rem",
          }}
        >
          <p style={{ fontWeight: 600, color: "#166534", fontSize: 15 }}>
            Deployed successfully!
          </p>
          <p style={{ fontSize: 13, color: "#4ade80", marginTop: 4 }}>
            GitHub Actions will now build and deploy the site. It'll be live in
            ~2 minutes.
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: "1rem 1.25rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 10,
            marginBottom: "1.5rem",
          }}
        >
          <p style={{ fontWeight: 600, color: "#991b1b", marginBottom: 4 }}>
            Deployment failed
          </p>
          <p
            style={{
              fontSize: 13,
              color: "#dc2626",
              fontFamily: "monospace",
              wordBreak: "break-word",
            }}
          >
            {error}
          </p>
        </div>
      )}

      {/* Note about CF_API_TOKEN */}
      {!deploying && !done && (
        <div
          style={{
            padding: "10px 14px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 8,
            marginBottom: "1.5rem",
            fontSize: 12,
            color: "#92400e",
          }}
        >
          <strong>Note:</strong> CF_API_TOKEN is stored as an encrypted GitHub Actions
          secret automatically. CF_PROJECT_NAME and CF_ACCOUNT_ID are added as
          repository variables.
        </div>
      )}

      {/* Buttons */}
      <div
        style={{
          display: "flex",
          gap: 12,
          paddingTop: "1.5rem",
          borderTop: "1px solid #f3f4f6",
        }}
      >
        {!done && (
          <button
            type="button"
            onClick={onBack}
            disabled={deploying}
            style={{
              padding: "9px 20px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              color: deploying ? "#d1d5db" : "#6b7280",
              background: "white",
              cursor: deploying ? "not-allowed" : "pointer",
            }}
          >
            ← Back
          </button>
        )}

        {!done && (
          <button
            type="button"
            onClick={deploy}
            disabled={deploying}
            style={{
              marginLeft: "auto",
              padding: "9px 28px",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              color: "white",
              background: deploying ? "#9ca3af" : "#111827",
              cursor: deploying ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {deploying ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "white",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Deploying…
              </>
            ) : error ? (
              "Retry Deploy"
            ) : (
              "Deploy Restaurant Site →"
            )}
          </button>
        )}

        {done && (
          <a
            href="/"
            style={{
              padding: "9px 24px",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              color: "white",
              background: "#111827",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Back to dashboard →
          </a>
        )}
      </div>
    </div>
  );
}
