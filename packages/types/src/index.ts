export type SyncState = -1 | 0 | 1;

export interface CloudResourceRecord {
  id: number;
  vid: string;
  title: string;
  status: number;
  available: boolean;
  deleted: boolean;
  duration: number;
  size: number;
  category: string;
  sourceMd5: string;
  hasStaticCover: boolean;
  hasGifCover: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RenewResourceRow {
  id: number;
  vid: string;
  title: string;
  status: number;
  available: boolean;
  staticCoverUrl?: string;
  hasStaticCover: boolean;
  gifCoverUrl?: string;
  hasGifCover: boolean;
  resourceUrl?: string;
  resourceUrl2?: string;
  playUrl?: string;
  expiresAt: number;
}
