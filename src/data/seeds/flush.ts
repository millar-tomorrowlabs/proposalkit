import type { ProposalData } from "@/types/proposal"

export const flushProposal: ProposalData = {
  id: "",
  slug: "flush",
  title: "Flush & Seawards Shopify Migration",
  clientName: "Flush + Seawards",
  brandColor1: "#c2703c",
  brandColor2: "#3d7a8a",
  heroImageUrl: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80",
  tagline: "Two stores. One platform.",
  heroDescription:
    "A complete Shopify migration for Flush and Seawards. Ecommerce, point-of-sale, and everything in between.",
  ctaEmail: "millar@tomorrowstudios.io",
  recommendation:
    "is to proceed with the Total package to ensure the project launches by the end of May and is positioned for strong performance through June and July. This scope includes the brand, content, and growth components that most retailers ultimately implement after launch, allowing the full system to be designed and built together from the outset rather than layered on later as separate projects.",
  sections: ["summary", "scope", "timeline", "investment", "cta"],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),

  summary: {
    studioTagline: "Designing the next generation of commerce systems.",
    studioDescription:
      "Tomorrow Studios is a design and technology studio exploring the future of commerce. Based in Vancouver, Canada with a globally distributed team, we build modern ecommerce experiences, operational systems, and AI-enabled tools that help brands operate more effectively across digital and retail channels.",
    studioDescription2:
      "Our work sits at the intersection of design, engineering, and emerging technology, combining deep Shopify expertise with a broader focus on building smarter systems and better customer experiences.",
    projectOverview:
      "We're migrating Flush and Seawards from an offline register workflow to a modern ecommerce + POS setup.",
    projectDetail:
      "Flush and Seawards are currently running on an offline, cash-register-style workflow with QuickBooks as the accounting backbone. Flush has a limited WooCommerce site; Seawards is offline-only. This project delivers full ecommerce and modern in-store POS for both businesses, with trusted inventory visibility, smoother checkout, and an improved customer experience online and in-store.",
    projectDetail2:
      "June and July are peak seasons, so the goal is to have both stores launched by the end of May. We're presenting two options: a comprehensive Total package and a leaner Light package.",
    pillarsTagline: "Three workstreams that define this engagement.",
    pillars: [
      {
        label: "Commerce",
        description: "Shopify ecommerce + POS for both Flush and Seawards",
      },
      {
        label: "Operations",
        description: "Inventory, payments, and QuickBooks integration",
      },
      {
        label: "Growth",
        description: "Brand refresh, SEO, loyalty, and subscriptions (Total only)",
      },
    ],
  },

  scope: {
    outcomes: [
      "Flush and Seawards live on Shopify (online store and POS) by the end of May",
      "A better customer experience in-store and online",
      "A clean product catalog with accurate inventory quantities",
      "QuickBooks connected and syncing correctly",
      "SEO descriptions written for ~3,000 products",
      "Blog, bundles, loyalty program, and subscriptions set up",
    ],
    responsibilities: [
      "Provide supplier spreadsheet(s) for Flush and Seawards (products, variants, pricing, cost, vendor, SKUs/barcodes where applicable)",
      "Complete the physical inventory counts for both stores prior to go-live",
      "Own QuickBooks mapping decisions (accounts, categories, tax handling)",
      "Provide timely approvals",
      "Cover all platform and operating costs, including Shopify plans/apps, Shopify Payments fees, POS hardware, and domains/DNS access",
      "Usage-based AI tooling/API costs incurred during the project are billed to the merchant upon completion",
    ],
  },

  timeline: {
    subtitle: "Launch by end of May.",
    phases: [
      {
        name: "Kickoff & Setup",
        duration: "Week 1",
        description:
          "Align on workflows, timelines, and responsibilities. Set up Shopify accounts for both stores and begin platform configuration.",
      },
      {
        name: "Catalog & Inventory",
        duration: "Weeks 2 to 3",
        description:
          "Load product catalogs from supplier spreadsheets, configure variants and pricing, and begin inventory initialization support.",
      },
      {
        name: "Design & Build",
        duration: "Weeks 3 to 5",
        description:
          "Design and develop ecommerce storefronts for Flush and Seawards. Flush brand refresh (Total package). Mobile-first, performance-optimized.",
      },
      {
        name: "POS & Payments",
        duration: "Weeks 5 to 6",
        description:
          "Configure Shopify POS for both locations, enable Shopify Payments, and set up hardware. Inventory sync between online and in-store.",
      },
      {
        name: "QA & Go-Live",
        duration: "Weeks 7 to 8",
        description:
          "Full testing pass, go-live support, and stabilization. Post-launch monitoring to ensure a smooth transition before peak season.",
      },
      {
        name: "Post-Launch",
        duration: "Ongoing",
        description:
          "Support retainer begins. Blog posts, bundles, loyalty, and subscriptions delivered post-launch (Total package).",
      },
    ],
  },

  investment: {
    packages: [
      {
        id: "total",
        label: "Total",
        basePrice: 29000,
        baseDiscount: 5500,
        isRecommended: true,
        highlights: [
          "Includes everything in Light, plus growth & brand layers",
          "Two independent stores set up (Flush + Seawards): ecommerce + POS for each",
          "Shopify Payments enabled for both businesses",
          "Catalog + inventory setup from supplier spreadsheets",
          "1 in-person support session (4-hour on-site)",
          "Leadership support for first two months post-launch",
          "Discounted pricing on select add-ons",
        ],
      },
      {
        id: "light",
        label: "Light",
        basePrice: 23500,
        baseDiscount: 0,
        isRecommended: false,
        highlights: [
          "Table-stakes setup to launch both businesses by end of May",
          "Two independent stores set up (Flush + Seawards): ecommerce + POS for each",
          "Shopify Payments enabled for both businesses",
          "Catalog + inventory setup from supplier spreadsheets",
          "Inventory initialization support",
          "Go-live support + stabilization",
        ],
      },
    ],
    addOnCategories: [
      { id: "brand", label: "Brand" },
      { id: "integrations", label: "Integrations" },
      { id: "content", label: "Content & Growth" },
      { id: "support", label: "Support" },
    ],
    addOns: [
      {
        id: "flush-brand",
        label: "Flush brand refresh",
        description: "Logo, color palette, typography, messaging & brand guidelines",
        category: "brand",
        highlightInPackage: ["total"],
        packages: {
          total: { included: true },
          light: { price: 3000 },
        },
      },
      {
        id: "seawards-brand",
        label: "Seawards brand refresh",
        description: "Logo, color palette, typography, messaging & brand guidelines",
        category: "brand",
        packages: {
          total: { price: 2000 },
          light: { price: 3000 },
        },
      },
      {
        id: "quickbooks",
        label: "QuickBooks connector",
        description: "Connector setup + validation",
        category: "integrations",
        highlightInPackage: ["total"],
        packages: {
          total: { included: true },
          light: { price: 1500 },
        },
      },
      {
        id: "klaviyo",
        label: "Klaviyo Email/SMS setup",
        description: "Account configuration, Shopify integration & initial flow setup",
        category: "integrations",
        packages: {
          total: { price: 1350 },
          light: { price: 1500 },
        },
      },
      {
        id: "gorgias",
        label: "Gorgias Customer Support setup",
        description: "Helpdesk configuration, Shopify integration & initial ticket routing setup",
        category: "integrations",
        packages: {
          total: { price: 1080 },
          light: { price: 1200 },
        },
      },
      {
        id: "shopify-reporting",
        label: "Shopify analytics + reporting setup",
        description: "5 custom reports of the merchant's choosing",
        category: "support",
        packages: {
          total: { price: 450 },
          light: { price: 500 },
        },
      },
      {
        id: "seo",
        label: "SEO product descriptions",
        description: "Optimized descriptions across the full catalog (~3,000 SKUs)",
        category: "content",
        highlightInPackage: ["total"],
        packages: {
          total: { included: true },
          light: { price: 2000 },
        },
      },
      {
        id: "blog",
        label: "Blog setup + 5 posts",
        description: "Blog configuration & 5 posts on merchant-provided topics",
        category: "content",
        highlightInPackage: ["total"],
        packages: {
          total: { included: true },
          light: { price: 1000 },
        },
      },
      {
        id: "bundles-loyalty",
        label: "Bundles, Loyalty & Subscriptions",
        description: "Full setup for bundles, loyalty program & subscription enablement",
        category: "content",
        highlightInPackage: ["total"],
        packages: {
          total: { included: true },
          light: { price: 3000 },
        },
      },
    ],
    retainer: {
      hourlyRate: 150,
      minHours: 3,
      maxHours: 10,
      requiredMonths: 6,
    },
  },
}
