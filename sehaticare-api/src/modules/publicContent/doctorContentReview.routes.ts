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
              content_version: true,
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
        art.approved_content_hash === currentHash &&
        art.approved_content_version === art.content_version &&
        latestReview &&
        latestReview.decision === 'APPROVED' &&
        latestReview.content_hash === currentHash &&
        latestReview.content_version === art.content_version
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
        content_version: art.content_version,
        approved_content_version: art.approved_content_version,
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
      article.approved_content_hash === currentHash &&
      article.approved_content_version === article.content_version &&
      latestReview &&
      latestReview.decision === 'APPROVED' &&
      latestReview.content_hash === currentHash &&
      latestReview.content_version === article.content_version
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
      content_version: article.content_version,
      approved_content_version: article.approved_content_version,
      current_content_hash: currentHash,
      approved_content_hash: article.approved_content_hash,
      is_clinically_approved: isApprovedForCurrent,
      reviews_history: article.article_clinical_reviews.map((r) => ({
        id: r.id,
        decision: r.decision,
        content_hash: r.content_hash,
        content_version: r.content_version,
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

    try {
      const reviewResult = await prisma.$transaction(async (tx) => {
        // 1. Lock article row with SELECT ... FOR UPDATE
        const lockedRows = await tx.$queryRaw<any[]>`
          SELECT * FROM "education_articles" WHERE id = ${id}::uuid FOR UPDATE
        `;
        const article = lockedRows[0];
        if (!article) {
          throw new Error('NOT_FOUND');
        }

        // Restrict review to eligible workflow states (REVIEW only)
        if (article.publication_status !== 'REVIEW') {
          const err: any = new Error(`Artikel dalam status ${article.publication_status} tidak dapat ditelaah. Hanya artikel dalam status REVIEW yang dapat ditelaah klinis.`);
          err.statusCode = 400;
          throw err;
        }

        // Verify doctor reviewer eligibility atomically inside transaction
        const reviewerUser = await tx.users.findUnique({
          where: { id: req.user!.userId },
          include: { doctor_profiles_doctor_profiles_user_idTousers: true }
        });

        if (!reviewerUser || !reviewerUser.is_active || reviewerUser.role !== 'DOKTER') {
          const err: any = new Error('Hanya dokter aktif yang dapat melakukan penelaahan medis klinis');
          err.statusCode = 403;
          throw err;
        }

        const profile = reviewerUser.doctor_profiles_doctor_profiles_user_idTousers;
        if (!profile || profile.verification_status !== 'VERIFIED') {
          const err: any = new Error('Profil dokter belum terverifikasi secara resmi');
          err.statusCode = 403;
          throw err;
        }

        // Compute canonical hash of current locked content
        const currentHash = computeArticleContentHash(article);

        // Verify submitted hash matches current canonical hash of the article
        if (b.content_hash !== currentHash) {
          const err: any = new Error('Konten artikel telah berubah sejak dimuat untuk penelaahan. Muat ulang artikel versi terkini sebelum memberikan telaah medis.');
          err.statusCode = 409;
          throw err;
        }

        // If decision is APPROVED, source_reference must be authoritative
        if (b.decision === 'APPROVED') {
          if (!article.source_reference || !article.source_reference.trim()) {
            const err: any = new Error('Artikel tidak memiliki referensi sumber resmi. Penelaahan medis memerlukan tautan sumber valid.');
            err.statusCode = 400;
            throw err;
          }
          const authCheck = isAuthoritativeSourceUrl(article.source_reference);
          if (!authCheck.valid) {
            const err: any = new Error(authCheck.reason || 'Sumber referensi artikel harus berasal dari otoritas kesehatan resmi.');
            err.statusCode = 400;
            throw err;
          }
        }

        const reviewId = randomUUID();

        // Persist review evidence atomically with active content_version
        const review = await tx.article_clinical_reviews.create({
          data: {
            id: reviewId,
            article_id: article.id,
            reviewer_id: req.user!.userId,
            decision: b.decision,
            content_hash: currentHash,
            content_version: article.content_version,
            source_reference: article.source_reference,
            notes: b.notes ?? null,
            reviewed_at: new Date()
          }
        });

        if (b.decision === 'APPROVED') {
          const updateCount = await tx.$executeRaw`
            UPDATE "education_articles"
            SET
              reviewer_id = ${req.user!.userId}::uuid,
              approved_content_hash = ${currentHash},
              approved_content_version = ${article.content_version},
              updated_at = NOW()
            WHERE id = ${article.id}::uuid AND content_version = ${article.content_version}
          `;
          if (updateCount === 0) {
            throw new Error('CONCURRENT_MUTATION');
          }
        } else {
          // REJECTED reverts article to DRAFT, invalidates approval, and increments version
          const newVersion = article.content_version + 1;
          const updateCount = await tx.$executeRaw`
            UPDATE "education_articles"
            SET
              reviewer_id = NULL,
              approved_content_hash = NULL,
              approved_content_version = NULL,
              publication_status = 'DRAFT'::publication_status,
              is_published = false,
              published_at = NULL,
              content_version = ${newVersion},
              updated_at = NOW()
            WHERE id = ${article.id}::uuid AND content_version = ${article.content_version}
          `;
          if (updateCount === 0) {
            throw new Error('CONCURRENT_MUTATION');
          }
        }

        // Record Audit Log inside the SAME transaction
        await recordAuditLog(tx, {
          actorUserId: req.user!.userId,
          action: 'ARTICLE_CLINICAL_REVIEW',
          entityType: 'education_article',
          entityId: article.id,
          meta: {
            decision: b.decision,
            content_hash: currentHash,
            content_version: article.content_version,
            reviewer_id: req.user!.userId,
            notes: b.notes ?? null,
            review_id: review.id
          }
        });

        return review;
      });

      return reply.code(201).send({
        id: reviewResult.id,
        article_id: reviewResult.article_id,
        decision: reviewResult.decision,
        content_hash: reviewResult.content_hash,
        content_version: reviewResult.content_version,
        reviewed_at: reviewResult.reviewed_at
      });
    } catch (err: any) {
      if (err.message === 'NOT_FOUND') return reply.code(404).send({ message: 'Artikel tidak ditemukan' });
      if (err.message === 'CONCURRENT_MUTATION') {
        return reply.code(409).send({ message: 'Konten artikel telah berubah sejak dimuat untuk penelaahan. Muat ulang artikel versi terkini sebelum memberikan telaah medis.' });
      }
      if (err.statusCode) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  };

  // Support both POST /:id and POST /:id/review
  app.post('/:id', submitReview);
  app.post('/:id/review', submitReview);
}

