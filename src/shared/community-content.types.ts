/** Aulas e inspirações da aba "Conteúdos" do app (`/admin/community/lessons` e `/admin/community/inspirations`). */

export interface CommunityLesson {
  id: string;
  title: string;
  description: string | null;
  /** Capa 16:9. */
  thumbnail_url: string | null;
  video_url: string;
  /** 0 = aula livre. */
  points_cost: number;
  duration_seconds: number | null;
  category: string | null;
  /** Usuário que dá a aula; vazio = aula da plataforma. */
  instructor_id: string | number | null;
  /** Quantas pessoas já desbloquearam. */
  unlocks_count: number;
  created_at: string;
}

export interface CommunityLessonBody {
  title: string;
  video_url: string;
  thumbnail_url?: string | null;
  description?: string | null;
  points_cost?: number;
  duration_seconds?: number | null;
  category?: string | null;
  instructor_id?: string | null;
}

export interface CommunityInspiration {
  id: string;
  title: string;
  /** Foto, ou poster quando há vídeo. */
  image_url: string;
  /** Reel vertical 9:16 (1080x1920). */
  video_url: string | null;
  author_id: string | number | null;
  /** Nome da marca quando não há autor. */
  source: string | null;
  created_at?: string;
}

export interface CommunityInspirationBody {
  title: string;
  image_url: string;
  video_url?: string | null;
  author_id?: string | null;
  source?: string | null;
}

export const LESSON_TITLE_MAX = 150;
export const LESSON_DESCRIPTION_MAX = 4000;
export const LESSON_CATEGORY_MAX = 60;
export const LESSON_POINTS_MAX = 1_000_000;
