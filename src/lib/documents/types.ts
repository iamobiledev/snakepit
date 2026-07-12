/** Shared document types safe to import from client components. */

export type DocumentVisibility = "private" | "workspace" | "public";

export type DocumentType = "doc" | "wiki";

export type DocumentTreeNode = {
  id: string;
  title: string;
  parentId: string | null;
  icon: string | null;
  visibility: DocumentVisibility;
  docType: DocumentType;
  locked: boolean;
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
