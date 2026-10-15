import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { authGuard } from '../../middlewares/auth';
import { recordAuditLog } from '../../utils/audit';
import { clinicalReviewSchema, isAuthoritativeSourceUrl, pagination } from './content.validators';
import { computeArticleContentHash, verifyDoctorReviewerEligibility } from './contentReview.service';

export default async function doctorContentReviewRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authGuard);

  // Guard: Must be authenticated active DOKTER with VERIFIED doctor_profiles
  app.addHook('preHandler', async (req, reply) => {
    if (req.user?.role !== 'DOKTER') {
      return reply.code(403).send({ message: 'Hanya dokter yang memiliki akses ke penelaahan medis edukasi' });
    }
    const check = await verifyDoctorReviewerEligibility(req.user!.userId);
    if (!check.eligible) {
      return reply.code(check.statusCode).send({ message: check.message });
    }
  });

  // GET / - list articles eligible for review or inspection
  app.get('/', async (req, reply) => {
    const p = pagination(req.query);
    const statusFilter = (req.query as any)?.status;
    const where = statusFilter ? { publication_status: statusFilter } : {};

    const [items, total] = await Promise.all([
      prisma.education_articles.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: [{ publication_status: 'asc' }, { updated_at: 'desc' }],
        include: {
          content_categories: { select: { slug: true, name: true } },
          article_clinical_reviews: {
            orderBy: { reviewed_at: 'desc' },
            take: 1,
            select: {
              id: true,
              decision: true,
              content_hash: true,
              reviewed_at: true,
              reviewer_id: true,
              notes: true
            }
          }
        }
      }),
      prisma.education_articles.count({ where })
    ]);

    const enriched = items.map((art) => {
      const currentHash = computeArticleContentHash(art as any);
      const latestReview = art.article_clinical_reviews[0] ?? null;
      const isApprovedForCurrent = Boolean(
        latestReview &&
        latestReview.decision === 'APPROVED' &&
        latestReview.content_hash === currentHash
      );

      return {
        id: art.id,
        title: art.title,
        slug: art.slug,
        summary: art.summary,
        body_markdown: art.body_markdown,
        category: art.content_categories,
        language: art.language,
        source_reference: art.source_reference,
        reading_minutes: art.reading_minutes,
        featured: art.featured,
        publication_status: art.publication_status,
        is_published: art.is_published,
        current_content_hash: currentHash,
        approved_content_hash: art.approved_content_hash,
        is_clinically_approved: isApprovedForCurrent,
        latest_review: latestReview
      };
    });

    return { page: p.page, limit: p.limit, total, items: enriched };
  });

  // GET /:id - inspect article details for clinical review
  app.get('/:id', async (req, reply) => {
    const id = (req.params as any).id;
    const article = await prisma.education_articles.findUnique({
      where: { id },
      include: {
        content_categories: { select: { slug: true, name: true } },
        article_clinical_reviews: {
          orderBy: { reviewed_at: 'desc' },
          include: {
            reviewer: { select: { id: true, full_name: true, role: true } }
          }
        }
      }
    });

    if (!article) return reply.code(404).send({ message: 'Artikel tidak ditemukan' });

    const currentHash = computeArticleContentHash(article as any);
    const latestReview = article.article_clinical_reviews[0] ?? null;
    const isApprovedForCurrent = Boolean(
      latestReview &&
      latestReview.decision === 'APPROVED' &&
      latestReview.content_hash === currentHash
    );

    return {
      id: article.id,
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      body_markdown: article.body_markdown,
      category: article.content_categories,
      language: article.language,
      source_reference: article.source_reference,
      thumbnail_key: article.thumbnail_key,
      thumbnail_alt: article.thumbnail_alt,
      reading_minutes: article.reading_minutes,
      featured: article.featured,
      publication_status: article.publication_status,
      is_published: article.is_published,
      current_content_hash: currentHash,
      approved_content_hash: article.approved_content_hash,
      is_clinically_approved: isApprovedForCurrent,
      reviews_history: article.article_clinical_reviews.map((r) => ({
        id: r.id,
        decision: r.decision,
        content_hash: r.content_hash,
        source_reference: r.source_reference,
        notes: r.notes,
        reviewed_at: r.reviewed_at,
        reviewer_name: r.reviewer?.full_name ?? 'Dokter'
      }))
    };
  });

  const submitReview = async (req: any, reply: any) => {
    const id = (req.params as any).id;
    const b = clinicalReviewSchema.parse(req.body);

    const article = await prisma.education_articles.findUnique({ where: { id } });
    if (!article) return reply.code(404).send({ message: 'Artikel tidak ditemukan' });

    // Compute canonical hash of current content
    const currentHash = computeArticleContentHash(article as any);

    // Verify hash provided by client matches the server-computed canonical hash
    if (b.content_hash !== currentHash) {
      return reply.code(409).send({
        message: 'Konten artikel telah berubah sejak dimuat untuk penelaahan. Muat ulang artikel versi terkini sebelum memberikan telaah medis.'
      });
    }

    // If decision is APPROVED, source_reference must be authoritative
    if (b.decision === 'APPROVED') {
      if (!article.source_reference || !article.source_reference.trim()) {
        return reply.code(400).send({
          message: 'Artikel tidak memiliki referensi sumber resmi. Penelaahan medis memerlukan tautan sumber valid.'
        });
      }
      const authCheck = isAuthoritativeSourceUrl(article.source_reference);
      if (!authCheck.valid) {
        return reply.code(400).send({
          message: authCheck.reason || 'Sumber referensi artikel harus berasal dari otoritas kesehatan resmi.'
        });
      }
    }

    const reviewId = randomUUID();

    // Persist review evidence atomically
    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.article_clinical_reviews.create({
        data: {
          id: reviewId,
          article_id: article.id,
          reviewer_id: req.user!.userId,
          decision: b.decision,
          content_hash: currentHash,
          source_reference: article.source_reference,
          notes: b.notes ?? null,
          reviewed_at: new Date()
        }
      });

      if (b.decision === 'APPROVED') {
        await tx.education_articles.update({
          where: { id: article.id },
          data: {
            reviewer_id: req.user!.userId,
            approved_content_hash: currentHash,
            updated_at: new Date()
          }
        });
      } else {
        // REJECTED moves article to DRAFT
        await tx.education_articles.update({
          where: { id: article.id },
          data: {
            reviewer_id: null,
            approved_content_hash: null,
            publication_status: 'DRAFT',
            is_published: false,
            published_at: null,
            updated_at: new Date()
          }
        });
      }

      return review;
    });

    await recordAuditLog(prisma, {
      actorUserId: req.user!.userId,
      action: 'ARTICLE_CLINICAL_REVIEW',
      entityType: 'education_article',
      entityId: article.id,
      meta: {
        decision: b.decision,
        content_hash: currentHash,
        reviewer_id: req.user!.userId,
        notes: b.notes ?? null,
        review_id: result.id
      }
    });

    return reply.code(201).send({
      id: result.id,
      article_id: result.article_id,
      decision: result.decision,
      content_hash: result.content_hash,
      reviewed_at: result.reviewed_at
    });
  };

  // Support both POST /:id and POST /:id/review
  app.post('/:id', submitReview);
  app.post('/:id/review', submitReview);
}

