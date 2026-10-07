import { FastifyInstance } from 'fastify';
import { getEducationById, listPublishedEducation } from './education.service';
import { toSafeEducationDetail } from './education.presenter';

function extractEducationMeta(body_markdown: string) {
  const lines = (body_markdown ?? '').split('\n');
  const metaRegex = /^\s*<!--\s*sehaticare:(summary|category)\s*=\s*(.*?)\s*-->\s*$/i;

  let summary: string | null = null;
  let category: string | null = null;
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const match = line.match(metaRegex);
    if (!match) {
      cleanedLines.push(line);
      continue;
    }

    const key = match[1].toLowerCase();
    const value = match[2]?.trim();
    if (!value) continue;

    if (key === 'summary') summary = value;
    if (key === 'category') category = value;
  }

  return { summary, category, body_markdown: cleanedLines.join('\n').trim() };
}

export default async function educationRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Education'],
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    summary: { type: 'string' },
                    category: { type: ['string', 'null'] },
                    created_at: { type: 'string', format: 'date-time' }
                  },
                  required: ['id', 'title', 'summary', 'created_at']
                }
              }
            },
            required: ['page', 'limit', 'total', 'items']
          }
        }
      }
    },
    async (request, reply) => {
      const { q, page = 1, limit = 10 } = request.query as { q?: string; page?: number; limit?: number };
      const safeLimit = Math.min(Math.max(limit ?? 10, 1), 50);
      const safePage = Math.max(page ?? 1, 1);
      const skip = (safePage - 1) * safeLimit;

      const { items, total } = await listPublishedEducation({ q, skip, take: safeLimit });

      const mapped = items.map((article) => {
        const extracted = extractEducationMeta(article.body_markdown ?? '');
        const cleanBody = extracted.body_markdown.replace(/\s+/g, ' ').trim();
        const derivedSummary = cleanBody.slice(0, 140);
        const derivedCategory = extracted.category ?? (article.title.toLowerCase().includes('hiv') ? 'HIV/AIDS' : null);

        return {
          id: article.id,
          title: article.title,
          summary: extracted.summary ?? derivedSummary,
          category: derivedCategory,
          created_at: article.created_at
        };
      });

      return reply.send({
        page: safePage,
        limit: safeLimit,
        total,
        items: mapped
      });
    }
  );

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const article = await getEducationById(id);
    if (!article) return reply.status(404).send({ message: 'Article not found' });

    const extracted = extractEducationMeta(article.body_markdown ?? '');
    return reply.send(toSafeEducationDetail(article, extracted));
  });
}
