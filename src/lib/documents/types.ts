/** Shared document types safe to import from client components. */

export type DocumentVisibility = "private" | "workspace" | "public";

export type DocumentTreeNode = {
  id: string;
  title: string;
  parentId: string | null;
  icon: string | null;
  visibility: DocumentVisibility;
  updatedAt: Date;
  createdById: string;
  children: DocumentTreeNode[];
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  isPersonal: boolean;
  role: "owner" | "admin" | "member" | "guest";
};
