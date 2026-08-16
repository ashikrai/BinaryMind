/**
 * Domain types shared across features.
 */

export type BlockType =
  | "title"
  | "subtitle"
  | "h1"
  | "h2"
  | "h3"
  | "paragraph"
  | "quote"
  | "pullquote"
  | "divider"
  | "bullet"
  | "numbered"
  | "checklist"
  | "image"
  | "code"
  | "html"
  | "iframe"
  | "callout"
  | "youtube"
  | "tweet"
  | "gist"
  | "bookmark"
  | "table";

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  /** Optional metadata (language for code, url for image, checked state, etc.) */
  meta?: Record<string, unknown>;
}

export type BlogStatus = "draft" | "published" | "archived" | "deleted";

export interface Collaborator {
  userId: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface Blog {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  title: string;
  slug: string;
  description: string;
  coverImage?: string;
  tags: string[];
  categories: string[];
  blocks: Block[];
  status: BlogStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  /** Co-authors added by the owner. Populated when the blog is loaded. */
  collaborators?: Collaborator[];
  seo: {
    title?: string;
    description?: string;
    canonical?: string;
  };
  stats: {
    views: number;
    likes: number;
    shares: number;
    readingTime: number; // minutes
    wordCount: number;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  bio?: string;
  social?: {
    twitter?: string;
    github?: string;
    website?: string;
  };
  joinedAt: string;
  /**
   * Which avatar / display-name source to use.
   * "google"  → use the Google profile picture and name
   * "medium"  → use the Medium profile picture and name (requires connected Medium account)
   */
  avatarSource?: "google" | "medium";
}

export interface AuthSession {
  user: UserProfile;
  token: string;
  issuedAt: string;
}
