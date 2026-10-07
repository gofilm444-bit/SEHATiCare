type EducationSource = {
  id: string;
  title: string;
  body_markdown: string;
  created_at: Date;
};

export function toSafeEducationDetail(
  article: EducationSource,
  extracted: { body_markdown: string; summary: string | null; category: string | null }
) {
  const cleanBody = extracted.body_markdown.replace(/\s+/g, ' ').trim();
  return {
    id: article.id,
    title: article.title,
    body_markdown: extracted.body_markdown,
    created_at: article.created_at,
    summary: extracted.summary ?? cleanBody.slice(0, 140),
    category: extracted.category ?? (article.title.toLowerCase().includes('hiv') ? 'HIV/AIDS' : null)
  };
}
