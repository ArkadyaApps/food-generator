import type { SiteFormData, LocaleContent } from "@/lib/validations/site";
import { THEMES } from "@/lib/themes";

export function generateLogoSvg(restaurantName: string, accentColor: string): string {
  const initial = (restaurantName.trim().split(/\s+/)[0]?.[0] ?? "R").toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="10" fill="${accentColor}"/><text x="40" y="56" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="44" fill="rgba(255,255,255,0.92)">${initial}</text></svg>`;
}

export function generateSiteConfig(data: SiteFormData): string {
  const theme = THEMES.find((t) => t.id === data.theme)!;
  const photos = data.photos.map((p, i) => {
    const ext = p.mimeType.split("/")[1] || "jpeg";
    return `/images/menu${i + 1}.${ext}`;
  });

  const logoExt = data.logo
    ? (data.logo.mimeType === "image/svg+xml" ? "svg" : data.logo.mimeType.split("/")[1] || "png")
    : "svg";
  const logoPath = `/images/logo.${logoExt}`;

  return `import type { SiteConfig } from "./types";

export const siteConfig: SiteConfig = {
  name: ${JSON.stringify(data.name)},
  slug: ${JSON.stringify(data.slug)},
  timezone: ${JSON.stringify(data.timezone)},
  defaultLocale: ${JSON.stringify(data.defaultLocale)},
  theme: ${JSON.stringify(data.theme)},
  fonts: {
    display: ${JSON.stringify(theme.fonts.display)},
    body: ${JSON.stringify(theme.fonts.body)},
    googleFontsUrl: ${JSON.stringify(theme.fonts.googleFontsUrl)},
  },
  contact: {
    whatsapp: ${JSON.stringify(data.whatsapp)},
    whatsappDisplay: ${JSON.stringify(data.whatsappDisplay)},
    socialType: ${JSON.stringify(data.socialType)},
    socialHandle: ${JSON.stringify(data.socialHandle ?? "")},
    socialUrl: ${JSON.stringify(data.socialUrl ?? "")},
    address: ${JSON.stringify(data.address)},
    mapsLat: ${data.mapsLat},
    mapsLng: ${data.mapsLng},
  },
  hours: {
    monday: ${JSON.stringify(data.hours.monday)},
    tuesday: ${JSON.stringify(data.hours.tuesday)},
    wednesday: ${JSON.stringify(data.hours.wednesday)},
    thursday: ${JSON.stringify(data.hours.thursday)},
    friday: ${JSON.stringify(data.hours.friday)},
    saturday: ${JSON.stringify(data.hours.saturday)},
    sunday: ${JSON.stringify(data.hours.sunday)},
  },
  menuMode: ${JSON.stringify(data.menuMode)},
  images: {
    logo: ${JSON.stringify(logoPath)},
    menu: ${JSON.stringify(photos)},
  },
};
`;
}

export function generateWorkflow(branch: string): string {
  return `name: Deploy to Cloudflare Pages

on:
  push:
    branches: [${branch}]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - run: npm install --legacy-peer-deps

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: |
            ~/.cache/ms-playwright
            ~/.cache/puppeteer
          key: \${{ runner.os }}-playwright-\${{ hashFiles('package.json') }}

      - run: npx playwright install --with-deps chromium

      - name: Install ffmpeg (required by the hero-video render)
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      - name: Generate SEO share image
        run: npm run generate:og

      - name: Generate hero background video
        run: npm run generate:hero

      - run: npm run build

      - name: Deploy to Cloudflare Pages
        run: npx wrangler pages deploy dist --project-name=\${{ vars.CF_PROJECT_NAME }} --branch=${branch}
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CF_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: \${{ vars.CF_ACCOUNT_ID }}
`;
}

export function generateAstroConfig(data: SiteFormData, siteUrl: string): string {
  return `import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  integrations: [
    react(),
    sitemap({
      // Only real pages — utility endpoints (robots.txt, llms.txt, OG image) aren't pages.
      filter: (page) => !/\\/(robots|llms|llms-full)\\.txt$/.test(page),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias:
        process.env.NODE_ENV === "production"
          ? { "react-dom/server": "react-dom/server.edge" }
          : undefined,
    },
  },
  i18n: {
    defaultLocale: ${JSON.stringify(data.defaultLocale)},
    locales: ["en", "fr", "th"],
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: true },
  },
  site: ${JSON.stringify(siteUrl)},
});
`;
}

export function generateWranglerToml(
  data: SiteFormData,
  d1Uuid: string,
  projectName: string = data.slug
): string {
  return `name = "${projectName}"
compatibility_date = "2025-02-13"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "./dist"

[[d1_databases]]
binding = "DB"
database_name = "${data.slug}-db"
database_id = "${d1Uuid}"
migrations_dir = "./migrations"

[vars]
WHATSAPP_TO = "${data.whatsapp}"
RESTAURANT_NAME = "${data.name}"
RESTAURANT_TIMEZONE = "${data.timezone}"
`;
}

function buildLocaleJson(data: SiteFormData, t: LocaleContent) {
  // t fields fall back to EN values if empty
  const heroEyebrow = t.heroEyebrow || data.heroEyebrow;
  const heroTitle = t.heroTitle || data.heroTitle;
  const heroSubtitle = t.heroSubtitle || data.heroSubtitle;
  const aboutTitle = t.aboutTitle || data.aboutTitle;
  const aboutPullquote = t.aboutPullquote || data.aboutPullquote;
  const aboutBody = t.aboutBody || data.aboutBody;
  const menuIntro = t.menuIntro || data.menuIntro;
  const footerTagline = t.footerTagline || data.footerTagline;
  const footerAddressShort = t.footerAddressShort || data.footerAddressShort;
  const footerHoursShort = t.footerHoursShort || data.footerHoursShort;

  return {
    nav: { home: "Home", menu: "Menu", booking: "Reservations", contact: "Contact" },
    hero: {
      eyebrow: heroEyebrow,
      tonight: "Tonight",
      title: heroTitle,
      subtitle: heroSubtitle,
      cta: "Reserve a table",
      secondaryCta: "View hours",
    },
    about: { title: aboutTitle, pullquote: aboutPullquote, body: aboutBody },
    hours: {
      title: "Hours",
      tonightLabel: "Tonight",
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday",
      sunday: "Sunday",
      closed: "Closed",
      openLabel: "Open this evening",
      closedLabel: "Closed today",
      openNow: "Open now",
      openSubline: "Open tonight",
      openingTonight: "Opening tonight",
      openingSubline: "See hours below",
      closedSubline: "See the week below",
    },
    reservation: { line: "Reserve your table.", cta: "Reserve a table" },
    menu: {
      title: "Menu",
      intro: menuIntro,
      comingSoon: "Full menu coming soon.",
      comingSoonSub: "Ask the kitchen about tonight's plates.",
      cta: "Reserve to taste tonight",
    },
    booking: {
      title: "Reserve a table",
      intro: "We confirm every booking by WhatsApp.",
      meta: {
        title: "Reservation note",
        serviceLabel: "Service",
        serviceValue: footerHoursShort,
        confirmLabel: "Confirmation",
        confirmValue: "Replied on WhatsApp.",
        directLabel: "Last-minute?",
        directValue: "Reach us directly on WhatsApp.",
      },
      name: "Your name",
      phone: "Phone (with country code)",
      email: "Email (optional)",
      partySize: "Number of guests",
      date: "Date",
      time: "Time",
      notes: "Anything we should know?",
      submit: "Request reservation",
      submitting: "Sending…",
      successTitle: "Thank you.",
      successBody: "Your request is in. We'll confirm by WhatsApp shortly.",
      errorTitle: "Something went wrong.",
      errorBody: "Please try again, or message us directly on WhatsApp.",
    },
    validation: {
      name: "Please enter your name.",
      phone: "Please enter a valid phone number.",
      email: "Please enter a valid email.",
      partySize: "Party size must be between 1 and 20.",
      date: "Please choose a date.",
      time: "Please choose a time.",
    },
    contact: {
      title: "Find us",
      addressLabel: "Address",
      address: data.address,
      whatsappLabel: "WhatsApp",
      directions: "Open in Google Maps",
    },
    social: {
      title: "Latest from the room",
      follow: data.socialHandle ? `Follow us · ${data.socialHandle}` : "Follow us",
    },
    footer: {
      tagline: footerTagline,
      rights: "All rights reserved.",
      addressShort: footerAddressShort,
      hoursShort: footerHoursShort,
    },
    menuItems: (data.menuItems ?? []).map(item => ({
      category: item.category,
      name: item.name,
      description: item.description,
      price: item.price,
      tags: item.tags,
    })),
  };
}

export function generateEnJson(data: SiteFormData): string {
  const enContent: LocaleContent = {
    heroEyebrow: data.heroEyebrow,
    heroTitle: data.heroTitle,
    heroSubtitle: data.heroSubtitle,
    aboutTitle: data.aboutTitle,
    aboutPullquote: data.aboutPullquote,
    aboutBody: data.aboutBody,
    menuIntro: data.menuIntro,
    footerTagline: data.footerTagline,
    footerAddressShort: data.footerAddressShort,
    footerHoursShort: data.footerHoursShort,
  };
  const json = buildLocaleJson(data, enContent);
  return JSON.stringify(json, null, 2);
}

export function generateFrJson(data: SiteFormData): string {
  return JSON.stringify(buildLocaleJson(data, data.translations?.fr ?? {}), null, 2);
}

export function generateThJson(data: SiteFormData): string {
  return JSON.stringify(buildLocaleJson(data, data.translations?.th ?? {}), null, 2);
}

