import { useFormContext } from "react-hook-form";
import type { SiteFormData } from "@/lib/validations/site";
import { StepHeader, Field, Input, Select, NavButtons } from "./shared";

interface Props {
  onNext: () => void;
  editMode?: boolean;
}

const TIMEZONES = [
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Hong_Kong",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/Paris",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
];

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function Step1Basic({ onNext, editMode = false }: Props) {
  const {
    register,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useFormContext<SiteFormData>();

  const name = watch("name");

  function handleNameBlur() {
    if (name) {
      const currentSlug = watch("slug");
      if (!currentSlug) {
        setValue("slug", slugify(name));
      }
    }
  }

  async function handleNext() {
    const valid = await trigger([
      "name",
      "slug",
      "tagline",
      "locationEyebrow",
      "timezone",
      "defaultLocale",
    ]);
    if (valid) onNext();
  }

  return (
    <div>
      <StepHeader
        step={1}
        title="Basic Information"
        subtitle="The foundation of your restaurant site."
      />

      <Field label="Restaurant Name" error={errors.name?.message}>
        <Input
          {...register("name")}
          onBlur={handleNameBlur}
          placeholder="Le Jardin"
          hasError={!!errors.name}
        />
      </Field>

      <Field
        label="URL Slug"
        error={errors.slug?.message}
        hint={editMode ? "Slug cannot be changed after deployment" : "Used as the address: slug.pages.dev (a close variant is used if that name is taken)"}
      >
        <Input
          {...register("slug")}
          placeholder="le-jardin"
          hasError={!!errors.slug}
          disabled={editMode}
          style={editMode ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
        />
      </Field>

      <Field label="Tagline" error={errors.tagline?.message}>
        <Input
          {...register("tagline")}
          placeholder="Fine dining in the heart of Bangkok"
          hasError={!!errors.tagline}
        />
      </Field>

      <Field
        label="Location Header"
        error={errors.locationEyebrow?.message}
        hint='Displayed above the logo (e.g. "Bangkok · Silom")'
      >
        <Input
          {...register("locationEyebrow")}
          placeholder="Bangkok · Silom"
          hasError={!!errors.locationEyebrow}
        />
      </Field>

      <Field label="Timezone" error={errors.timezone?.message}>
        <Select {...register("timezone")}>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Default Language" error={errors.defaultLocale?.message}>
        <div style={{ display: "flex", gap: 12 }}>
          {(["en", "fr", "th"] as const).map((locale) => {
            const labels = { en: "English", fr: "Français", th: "ภาษาไทย" };
            return (
              <label
                key={locale}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontSize: 14,
                  color: "#374151",
                  padding: "8px 16px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  userSelect: "none",
                }}
              >
                <input
                  type="radio"
                  value={locale}
                  {...register("defaultLocale")}
                  style={{ accentColor: "#111827" }}
                />
                {labels[locale]}
              </label>
            );
          })}
        </div>
      </Field>

      <NavButtons onNext={handleNext} />
    </div>
  );
}
