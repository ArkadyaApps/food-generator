import { z } from "zod";

const DaySchema = z
  .object({
    open: z.string(),
    close: z.string(),
  })
  .nullable();

const LocaleContentSchema = z.object({
  heroEyebrow: z.string().default(""),
  heroTitle: z.string().default(""),
  heroSubtitle: z.string().default(""),
  aboutTitle: z.string().default(""),
  aboutPullquote: z.string().default(""),
  aboutBody: z.string().default(""),
  menuIntro: z.string().default(""),
  footerTagline: z.string().default(""),
  footerAddressShort: z.string().default(""),
  footerHoursShort: z.string().default(""),
});

export type LocaleContent = z.infer<typeof LocaleContentSchema>;

export const MenuItemSchema = z.object({
  category: z.string().default(""),
  name: z.string().min(1, "Item name required"),
  description: z.string().default(""),
  price: z.string().default(""),
  tags: z.array(z.enum(["veg", "vegan", "gf", "spicy"])).default([]),
});

export type MenuItem = z.infer<typeof MenuItemSchema>;

export const SiteFormSchema = z.object({
  // Step 1 — Basic
  name: z.string().min(1, "Restaurant name required"),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, hyphens"),
  tagline: z.string().min(1, "Tagline required"),
  locationEyebrow: z
    .string()
    .min(1, "Location required (e.g. Bangkok · Silom)"),
  timezone: z.string().default("Asia/Bangkok"),
  defaultLocale: z.enum(["en", "fr", "th"]).default("en"),

  // Step 2 — Contact
  whatsapp: z.string().min(1, "WhatsApp number required"),
  whatsappDisplay: z.string().min(1, "WhatsApp display number required"),
  socialType: z.enum(["instagram", "facebook", "none"]).default("none"),
  socialHandle: z.string().optional(),
  socialUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  address: z.string().min(1, "Address required"),
  mapsUrl: z.string().url("Paste a Google Maps URL").optional().or(z.literal("")),
  mapsLat: z.number(),
  mapsLng: z.number(),

  // Step 3 — Hours
  hours: z.object({
    monday: DaySchema,
    tuesday: DaySchema,
    wednesday: DaySchema,
    thursday: DaySchema,
    friday: DaySchema,
    saturday: DaySchema,
    sunday: DaySchema,
  }),

  // Step 4 — Content (EN only, stored in i18n/en.json)
  heroTitle: z.string().min(1, "Hero title required"),
  heroSubtitle: z.string().min(1, "Hero subtitle required"),
  heroEyebrow: z.string().min(1, "Hero eyebrow required"),
  aboutTitle: z.string().default("The room"),
  aboutPullquote: z.string().min(1, "Pull quote required"),
  aboutBody: z.string().min(1, "About body text required"),
  menuIntro: z.string().min(1, "Menu intro required"),
  footerTagline: z.string().min(1, "Footer tagline required"),
  footerAddressShort: z.string().min(1, "Short address required"),
  footerHoursShort: z.string().min(1, "Hours summary required"),

  // Step 5 — Menu (photos and/or written items)
  menuMode: z.enum(["photos", "items", "both"]).default("photos"),
  photos: z
    .array(
      z.object({
        name: z.string(),
        data: z.string(), // base64
        mimeType: z.string(),
      })
    )
    .max(6, "Maximum 6 photos"),
  menuItems: z.array(MenuItemSchema).default([]),

  // Translations (FR + TH — optional, falls back to EN if empty)
  translations: z.object({
    fr: LocaleContentSchema,
    th: LocaleContentSchema,
  }).default({ fr: {}, th: {} }),

  // Step 7 — Logo (optional; auto-generated SVG if omitted)
  logo: z
    .object({
      data: z.string(),     // base64 encoded file content
      mimeType: z.string(),
      name: z.string(),
    })
    .optional(),

  // Step 6 — Theme
  theme: z.enum([
    "baroque-dark",
    "coastal-light",
    "tropical-modern",
    "tokyo-minimal",
    "mediterranean",
    "nordic-forest",
  ]),
});

export type SiteFormData = z.infer<typeof SiteFormSchema>;
