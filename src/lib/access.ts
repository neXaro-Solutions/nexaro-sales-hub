export type OrganizationRole = "owner" | "admin" | "sales" | "field_sales" | "read_only";

export const roleLabels: Record<OrganizationRole, string> = {
  owner: "Owner",
  admin: "Admin",
  sales: "Vertrieb",
  field_sales: "Außendienst",
  read_only: "Nur Lesen",
};

const allPages = ["dashboard","customers","hunter","calendar","sumup","vape","software","offers","knowledge","tasks","settings"] as const;

type PageId = (typeof allPages)[number];

const pagesByRole: Record<OrganizationRole, readonly PageId[]> = {
  owner: allPages,
  admin: allPages,
  sales: ["dashboard","customers","calendar","sumup","vape","software","offers","knowledge","tasks"],
  field_sales: ["dashboard","customers","hunter","calendar","sumup","knowledge","tasks"],
  read_only: ["dashboard","customers","hunter","calendar","sumup","vape","software","offers","knowledge","tasks"],
};

export function canAccessPage(role: OrganizationRole, page: string) {
  return pagesByRole[role].includes(page as PageId);
}

export function canEdit(role: OrganizationRole) {
  return role !== "read_only";
}

export function canManageTeam(role: OrganizationRole) {
  return role === "owner" || role === "admin";
}
