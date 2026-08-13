/**
 * Hand-rolled type map for the Supabase tables used by this project.
 * Matches the SQL schema in supabase/schema.sql.
 */
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar: string | null;
          bio: string | null;
          social_twitter: string | null;
          social_github: string | null;
          social_website: string | null;
          joined_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          avatar?: string | null;
          bio?: string | null;
          social_twitter?: string | null;
          social_github?: string | null;
          social_website?: string | null;
          joined_at?: string;
        };
        Update: {
          email?: string;
          name?: string;
          avatar?: string | null;
          bio?: string | null;
          social_twitter?: string | null;
          social_github?: string | null;
          social_website?: string | null;
        };
      };
      blogs: {
        Row: {
          id: string;
          author_id: string;
          author_name: string;
          author_avatar: string | null;
          title: string;
          slug: string;
          description: string;
          cover_image: string | null;
          tags: string[];
          categories: string[];
          blocks: unknown;
          status: string;
          created_at: string;
          updated_at: string;
          published_at: string | null;
          seo: unknown;
          views: number;
          likes: number;
          shares: number;
          reading_time: number;
          word_count: number;
        };
        Insert: {
          id: string;
          author_id: string;
          author_name: string;
          author_avatar?: string | null;
          title: string;
          slug: string;
          description?: string;
          cover_image?: string | null;
          tags?: string[];
          categories?: string[];
          blocks?: unknown;
          status?: string;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
          seo?: unknown;
          views?: number;
          likes?: number;
          shares?: number;
          reading_time?: number;
          word_count?: number;
        };
        Update: {
          author_name?: string;
          author_avatar?: string | null;
          title?: string;
          slug?: string;
          description?: string;
          cover_image?: string | null;
          tags?: string[];
          categories?: string[];
          blocks?: unknown;
          status?: string;
          updated_at?: string;
          published_at?: string | null;
          seo?: unknown;
          views?: number;
          likes?: number;
          shares?: number;
          reading_time?: number;
          word_count?: number;
        };
      };
      bookmarks: {
        Row: {
          user_id: string;
          blog_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          blog_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      blog_collaborators: {
        Row: {
          blog_id: string;
          user_id: string;
          added_at: string;
        };
        Insert: {
          blog_id: string;
          user_id: string;
          added_at?: string;
        };
        Update: Record<string, never>;
      };
    };
  };
}
