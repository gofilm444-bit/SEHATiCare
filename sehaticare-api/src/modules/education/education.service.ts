import { prisma } from '../../db/prisma';

export async function listPublishedEducation(params: { q?: string; skip: number; take: number }) {
  const where = {
    is_published: true,
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: 'insensitive' as const } },
            { body_markdown: { contains: params.q, mode: 'insensitive' as const } }
          ]
        }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.education_articles.findMany({
      where,
      orderBy: [{ published_at: 'desc' }, { created_at: 'desc' }],
      skip: params.skip,
      take: params.take,
      select: {
        id: true,
        title: true,
        body_markdown: true,
        created_at: true
      }
    }),
    prisma.education_articles.count({ where })
  ]);

  return { items, total };
}

export function getEducationById(id: string) {
  return prisma.education_articles.findFirst({
    where: { id, is_published: true },
    select: {
      id: true,
      title: true,
      body_markdown: true,
      created_at: true
    }
  });
}
