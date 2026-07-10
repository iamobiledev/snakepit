/**
 * Search service interface — Neon Postgres today, Typesense/Meilisearch later.
 * UI and route handlers depend only on this contract.
 */

export type SearchHit = {
  documentId: string;
  workspaceId: string;
  title: string;
  breadcrumbPath: string;
  snippet: string;
  score: number;
  updatedAt: Date;
  workspaceName?: string;
  creatorName?: string;
};

export type SearchQuery = {
  query: string;
  userId: string;
  workspaceId?: string;
  limit?: number;
  offset?: number;
};

export type SearchResult = {
  hits: SearchHit[];
  total: number;
  query: string;
};

export interface SearchService {
  search(input: SearchQuery): Promise<SearchResult>;
}
