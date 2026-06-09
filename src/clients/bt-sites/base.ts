/**
 * BT Site Adapter Base Interface
 */

export interface SearchOptions {
  category?: string;
  sort?: "seeders" | "date" | "size";
  limit?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  magnetUrl: string;
  size: number;
  seeders: number;
  leechers: number;
  uploadDate: Date;
  category?: string;
}

export abstract class BTSiteAdapter {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly baseUrl: string;

  abstract search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]>;

  abstract healthCheck(): Promise<boolean>;
}
