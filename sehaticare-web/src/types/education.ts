export interface EducationListItem {
  id: string;
  title: string;
  summary: string;
  category: string | null;
  created_at: string;
}

export interface EducationListResponse {
  page: number;
  limit: number;
  total: number;
  items: EducationListItem[];
}

export interface EducationDetail {
  id: string;
  title: string;
  body_markdown: string;
  created_at: string;
  category?: string | null;
  summary?: string | null;
}
