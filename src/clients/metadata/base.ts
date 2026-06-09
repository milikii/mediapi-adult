/**
 * JAV Metadata Adapter Base Interface
 */

export interface JAVMetadata {
  code: string;
  title_ja: string;
  title_zh: string;
  actress: string[];
  actress_zh: string[];
  maker: string;
  release_date: string;
  duration: number;
  category: string;
  poster_url?: string;
}

export abstract class MetadataAdapter {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly baseUrl: string;

  abstract getMetadata(code: string): Promise<JAVMetadata | null>;

  abstract healthCheck(): Promise<boolean>;
}
