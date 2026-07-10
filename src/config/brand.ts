/**
 * Centralized product naming and branding.
 * Replace values here to rebrand the application without hunting through the codebase.
 */
export const brand = {
  /** Temporary working product name */
  name: "Docloom",
  /** Short tagline used in marketing and metadata */
  tagline: "Your team's knowledge, organized.",
  /** Combined title for browser tabs and OG tags */
  get title() {
    return `${this.name} — ${this.tagline}`;
  },
  /** Support / from-name for transactional email */
  emailFromName: "Docloom",
  /** Default workspace name for seeded / first workspace */
  defaultWorkspaceName: "My Workspace",
  /** Public marketing description */
  description:
    "Docloom is a collaborative knowledge base for teams — documents, search, and shared workspaces.",
  /** Logo text fallback when no image is configured */
  logoText: "Docloom",
} as const;

export type Brand = typeof brand;
