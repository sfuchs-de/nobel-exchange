export type Allocation = Record<string, number>;
export type Source = { label: string; url: string };
export type ContenderGroup = "established" | "broad" | "future" | "outsider";
export type CandidateEvidence = {
  kind: "award" | "forecast" | "preview" | "market" | "longlist" | "advocacy";
  label: string;
  url: string;
  dateLabel: string;
  retrievedOn: string;
  targetYear?: number;
  note: string;
};
export type CitedArticle = {
  id: string;
  title: string;
  url: string;
  year: number;
  venue: string;
  citations: number;
  verification?: "crossref" | "openalex";
};
export type ArticleRanking = {
  status: "available" | "unavailable";
  retrievedOn: string;
  authorId?: string;
  queryUrl?: string;
  matchEvidence?: string;
  recordsExamined?: number;
  reason?: string;
  articles: CitedArticle[];
};
export type Candidate = {
  id: string;
  name: string;
  field: string;
  institution: string;
  summary: string;
  year: number | null;
  honors: string[];
  papers: { title: string; url: string; year?: number }[];
  mostCitedArticles?: ArticleRanking;
  sources: Source[];
  eligible: boolean;
  verifiedOn: string;
  profileUrl: string;
  aliases?: string[];
  tags?: string[];
  institutionBasis?: "award-time" | "current-profile";
  editorial: {
    group: ContenderGroup;
    reason: string;
    reviewedOn: string;
    priority?: number;
    evidence: CandidateEvidence[];
  };
  citations: null | {
    total: number;
    years: { year: number; count: number }[];
    openAlexId: string;
    retrieved: string;
    matchEvidence: string;
    trendScope: string;
  };
  portrait?: { url: string; source: string; license: string; author: string };
};
export type Entry = {
  id: string;
  displayName: string;
  allocation: Allocation;
  version: number;
  updatedAt: string;
};
export type Winner = { candidateId: string; name?: string; share: number };
export type Settlement = {
  winners: Winner[];
  source: string;
  reason: string;
  publishedAt: string;
  revision: number;
};
export type Snapshot = {
  marketId?: "original" | "public";
  phase: "setup" | "open" | "paused" | "closed" | "settled";
  closesAt: string;
  announcement: string;
  serverTime: string;
  revision: number;
  participants: number;
  rosterVersion?: string;
  rosterUpdates?: {version:string; approvedOn:string; reason:string; at:string; additions:{id:string;name:string}[]}[];
  pool: number;
  totals: Allocation;
  supporters: Allocation;
  history: { at: string; totals: Allocation; pool: number }[];
  entries?: Entry[];
  settlement?: Settlement;
};
export type Session = {
  id: string;
  displayName: string;
  admin: boolean;
  token: string;
  expiresAt: string;
};
