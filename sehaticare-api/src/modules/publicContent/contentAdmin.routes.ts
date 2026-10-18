import { FastifyInstance } from 'fastify'; import { randomUUID } from 'node:crypto'; import { prisma } from '../../db/prisma'; import { authGuard } from '../../middlewares/auth'; import { recordAuditLog } from '../../utils/audit'; import { generateDownloadUrl, generateUploadUrl, getObjectMetadata, getObjectPrefix } from '../voiceNotes/storage.service'; import { articleSchema, categorySchema, consentSchema, facilitySchema, isAuthoritativeSourceUrl, pagination, portalItemCreateSchema, portalItemUpdateSchema, portalReorderSchema, regionSchema, statisticSchema, statusSchema, videoSchema } from './content.validators'; import { computeArticleContentHash, getArticleLatestValidApproval } from './contentReview.service';
function admin(req:any,reply:any){if(req.user?.role!=='ADMIN'){reply.code(403).send({message:'Forbidden'});return false}return true}
async function audited(actor:string,action:string,id:string,meta:any={}){await recordAuditLog(prisma,{actorUserId:actor,action,entityType:'public_content',entityId:id,meta})}
export default async function contentAdminRoutes(app:FastifyInstance){
 app.addHook('preHandler',authGuard);
 app.get('/overview',async(req,reply)=>{if(!admin(req,reply))return;const [statistics,articles,videos,consents,facilities,regions]=await Promise.all([prisma.case_statistics.count(),prisma.education_articles.count(),prisma.education_videos.count(),prisma.media_consents.count(),prisma.health_facilities.count(),prisma.regions.count()]);return{statistics,articles,videos,consents,facilities,regions}});
 app.get('/regions',async(req,reply)=>{if(!admin(req,reply))return;return{items:await prisma.regions.findMany({orderBy:[{type:'asc'},{name:'asc'}]})}});
 app.post('/regions',async(req,reply)=>{if(!admin(req,reply))return;const b=regionSchema.parse(req.body);const item=await prisma.regions.create({data:{id:randomUUID(),...b,parent_id:b.parent_id??null,updated_at:new Date()}});await audited(req.user!.userId,'REGION_CREATED',item.id);return reply.code(201).send({id:item.id,code:item.code,name:item.name,type:item.type,is_active:item.is_active})});
 app.get('/categories',async(req,reply)=>{if(!admin(req,reply))return;return{items:await prisma.content_categories.findMany({orderBy:{name:'asc'}})}});
 app.post('/categories',async(req,reply)=>{if(!admin(req,reply))return;const b=categorySchema.parse(req.body);const item=await prisma.content_categories.create({data:{id:randomUUID(),...b,updated_at:new Date()}});await audited(req.user!.userId,'CONTENT_CATEGORY_CREATED',item.id);return reply.code(201).send(item)});
 app.put('/categories/:id',async(req,reply)=>{if(!admin(req,reply))return;const b=categorySchema.parse(req.body);const item=await prisma.content_categories.update({where:{id:(req.params as any).id},data:{...b,updated_at:new Date()}});await audited(req.user!.userId,'CONTENT_CATEGORY_UPDATED',item.id);return item});
 app.get('/statistics',async(req,reply)=>{if(!admin(req,reply))return;const p=pagination(req.query);const [items,total]=await Promise.all([prisma.case_statistics.findMany({skip:p.skip,take:p.limit,orderBy:{created_at:'desc'},include:{regions:{select:{name:true}}}}),prisma.case_statistics.count()]);return{...p,total,items}});
 app.post('/statistics',async(req,reply)=>{if(!admin(req,reply))return;const b=statisticSchema.parse(req.body);const item=await prisma.case_statistics.create({data:{id:randomUUID(),...b,created_by:req.user!.userId,updated_at:new Date()}});await audited(req.user!.userId,'STATISTIC_CREATED',item.id);return reply.code(201).send({id:item.id,publication_status:item.publication_status})});
 app.put('/statistics/:id',async(req,reply)=>{if(!admin(req,reply))return;const b=statisticSchema.parse(req.body);const item=await prisma.case_statistics.update({where:{id:(req.params as any).id},data:{...b,updated_at:new Date()}});await audited(req.user!.userId,'STATISTIC_UPDATED',item.id);return{id:item.id,publication_status:item.publication_status}});
 app.put('/statistics/:id/status',async(req,reply)=>{if(!admin(req,reply))return;const {status}=statusSchema.parse(req.body);const id=(req.params as any).id;const old=await prisma.case_statistics.findUnique({where:{id}});if(!old)return reply.code(404).send({message:'Not found'});if(status==='PUBLISHED'&&!old.source_name)return reply.code(400).send({message:'Source required'});const item=await prisma.case_statistics.update({where:{id},data:{publication_status:status,reviewer_id:status==='REVIEW'?req.user!.userId:old.reviewer_id,publisher_id:status==='PUBLISHED'?req.user!.userId:old.publisher_id,published_at:status==='PUBLISHED'?new Date():old.published_at,updated_at:new Date()}});await audited(req.user!.userId,'STATISTIC_STATUS_CHANGED',id,{status});return{id:item.id,status:item.publication_status}});
  app.get('/articles', async (req, reply) => {
    if (!admin(req, reply)) return;
    const p = pagination(req.query);
    const where = p.q ? { title: { contains: p.q, mode: 'insensitive' as const } } : {};
    const [items, total] = await Promise.all([
      prisma.education_articles.findMany({
        where,
        skip: p.skip,
        take: p.limit,
        orderBy: { updated_at: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          body_markdown: true,
          category_id: true,
          language: true,
          source_reference: true,
          thumbnail_key: true,
          thumbnail_alt: true,
          reading_minutes: true,
          featured: true,
          publication_status: true,
          is_published: true,
          reviewer_id: true,
          publisher_id: true,
          content_version: true,
          approved_content_version: true,
          approved_content_hash: true,
          updated_at: true,
          published_at: true,
          article_clinical_reviews: {
            orderBy: { reviewed_at: 'desc' },
            take: 1,
            select: {
              decision: true,
              content_hash: true,
              content_version: true
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

      const { article_clinical_reviews: _, ...rest } = art;
      return {
        ...rest,
        current_content_hash: currentHash,
        is_clinically_approved: isApprovedForCurrent
      };
    });

    return { page: p.page, limit: p.limit, total, items: enriched };
  });
  app.get('/articles/:id', async (req, reply) => {
    if (!admin(req, reply)) return;
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

    if (!article) return reply.code(404).send({ message: 'Not found' });

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
      ...article,
      current_content_hash: currentHash,
      is_clinically_approved: isApprovedForCurrent
    };
  });

  app.post('/articles', async (req, reply) => {
    if (!admin(req, reply)) return;
    const b = articleSchema.parse(req.body);
    const id = randomUUID();

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.education_articles.create({
        data: {
          id,
          ...b,
          category_id: b.category_id ?? null,
          thumbnail_key: b.thumbnail_key ?? null,
          thumbnail_alt: b.thumbnail_alt ?? null,
          publication_status: 'DRAFT',
          is_published: false,
          content_version: 1,
          approved_content_version: null,
          approved_content_hash: null,
          reviewer_id: null,
          created_by: req.user!.userId,
          updated_by: req.user!.userId,
          updated_at: new Date()
        }
      });

      await recordAuditLog(tx, {
        actorUserId: req.user!.userId,
        action: 'ARTICLE_CREATED',
        entityType: 'public_content',
        entityId: id,
        meta: { title: b.title, slug: b.slug }
      });

      return created;
    });

    return reply.code(201).send({ id: item.id, slug: item.slug, status: item.publication_status });
  });

  app.put('/articles/:id', async (req, reply) => {
    if (!admin(req, reply)) return;
    const b = articleSchema.parse(req.body);
    const id = (req.params as any).id;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Lock row with SELECT ... FOR UPDATE
        const lockedRows = await tx.$queryRaw<any[]>`
          SELECT * FROM "education_articles" WHERE id = ${id}::uuid FOR UPDATE
        `;
        const old = lockedRows[0];
        if (!old) {
          throw new Error('NOT_FOUND');
        }

        const oldHash = computeArticleContentHash(old);
        const newHash = computeArticleContentHash({
          ...b,
          category_id: b.category_id ?? null,
          thumbnail_key: b.thumbnail_key ?? null,
          thumbnail_alt: b.thumbnail_alt ?? null
        });

        const contentChanged = oldHash !== newHash;
        const mustRevertPublished = contentChanged && (old.publication_status === 'PUBLISHED' || old.is_published);
        const targetStatus = mustRevertPublished ? 'REVIEW' : old.publication_status;
        const targetIsPublished = mustRevertPublished ? false : old.is_published;
        const targetPublishedAt = mustRevertPublished ? null : old.published_at;
        const targetApprovedHash = contentChanged ? null : old.approved_content_hash;
        const targetApprovedVersion = contentChanged ? null : old.approved_content_version;
        const targetReviewerId = contentChanged ? null : old.reviewer_id;
        const newVersion = contentChanged ? old.content_version + 1 : old.content_version;

        // 2. Conditional Atomic Update on content_version
        const updateCount = await tx.$executeRaw`
          UPDATE "education_articles"
          SET 
            title = ${b.title},
            slug = ${b.slug},
            summary = ${b.summary},
            body_markdown = ${b.body_markdown},
            category_id = ${b.category_id ?? null}::uuid,
            thumbnail_key = ${b.thumbnail_key ?? null},
            thumbnail_alt = ${b.thumbnail_alt ?? null},
            language = ${b.language},
            source_reference = ${b.source_reference ?? null},
            reading_minutes = ${b.reading_minutes},
            featured = ${b.featured},
            publication_status = ${targetStatus}::publication_status,
            is_published = ${targetIsPublished},
            published_at = ${targetPublishedAt},
            approved_content_hash = ${targetApprovedHash},
            approved_content_version = ${targetApprovedVersion},
            reviewer_id = ${targetReviewerId}::uuid,
            content_version = ${newVersion},
            updated_by = ${req.user!.userId}::uuid,
            updated_at = NOW()
          WHERE id = ${id}::uuid AND content_version = ${old.content_version}
        `;

        if (updateCount === 0) {
          throw new Error('CONCURRENT_MUTATION');
        }

        // 3. Record Audit Log inside the SAME transaction
        await recordAuditLog(tx, {
          actorUserId: req.user!.userId,
          action: 'ARTICLE_UPDATED',
          entityType: 'public_content',
          entityId: id,
          meta: {
            content_changed: contentChanged,
            old_hash: oldHash,
            new_hash: newHash,
            old_version: old.content_version,
            new_version: newVersion,
            approval_invalidated: contentChanged,
            reverted_to_review: mustRevertPublished
          }
        });

        return {
          id,
          status: targetStatus,
          is_published: targetIsPublished,
          content_version: newVersion,
          is_clinically_approved: Boolean(
            targetApprovedHash &&
            targetApprovedHash === newHash &&
            targetApprovedVersion === newVersion
          )
        };
      });

      return result;
    } catch (err: any) {
      if (err.message === 'NOT_FOUND') return reply.code(404).send({ message: 'Not found' });
      if (err.message === 'CONCURRENT_MUTATION') {
        return reply.code(409).send({ message: 'Konten artikel telah dimutasi bersamaan oleh operasi lain.' });
      }
      throw err;
    }
  });

  app.put('/articles/:id/status', async (req, reply) => {
    if (!admin(req, reply)) return;
    const { status } = statusSchema.parse(req.body);
    const id = (req.params as any).id;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Lock row with SELECT ... FOR UPDATE
        const lockedRows = await tx.$queryRaw<any[]>`
          SELECT * FROM "education_articles" WHERE id = ${id}::uuid FOR UPDATE
        `;
        const current = lockedRows[0];
        if (!current) {
          throw new Error('NOT_FOUND');
        }

        if (status === 'PUBLISHED') {
          if (!current.source_reference || !current.source_reference.trim()) {
            const err: any = new Error('Source reference required to publish medical content');
            err.statusCode = 400;
            throw err;
          }
          const authCheck = isAuthoritativeSourceUrl(current.source_reference);
          if (!authCheck.valid) {
            const err: any = new Error(authCheck.reason || 'Authoritative source reference required');
            err.statusCode = 400;
            throw err;
          }

          if (current.publication_status === 'DRAFT') {
            const err: any = new Error('Artikel dalam status DRAFT tidak dapat langsung diterbitkan. Ajukan ke status REVIEW terlebih dahulu untuk penelaahan medis.');
            err.statusCode = 400;
            throw err;
          }

          const currentHash = computeArticleContentHash(current);

          // Authoritative clinical review check on the active content version inside transaction
          const approvalCheck = await getArticleLatestValidApproval(
            id,
            currentHash,
            current.content_version,
            tx
          );

          if (!approvalCheck.valid) {
            const err: any = new Error(approvalCheck.message);
            err.statusCode = approvalCheck.statusCode;
            throw err;
          }
          const approval = approvalCheck.approval!;

          const newVersion = current.content_version + 1;
          const updateCount = await tx.$executeRaw`
            UPDATE "education_articles"
            SET
              publication_status = 'PUBLISHED'::publication_status,
              is_published = true,
              published_at = NOW(),
              publisher_id = ${req.user!.userId}::uuid,
              reviewer_id = ${approval.reviewer_id}::uuid,
              approved_content_hash = ${currentHash},
              approved_content_version = ${current.content_version},
              content_version = ${newVersion},
              updated_by = ${req.user!.userId}::uuid,
              updated_at = NOW()
            WHERE id = ${id}::uuid AND content_version = ${current.content_version}
          `;

          if (updateCount === 0) {
            throw new Error('CONCURRENT_MUTATION');
          }

          await recordAuditLog(tx, {
            actorUserId: req.user!.userId,
            action: 'ARTICLE_PUBLISHED',
            entityType: 'public_content',
            entityId: id,
            meta: {
              publisher_id: req.user!.userId,
              reviewer_id: approval.reviewer_id,
              content_hash: currentHash,
              content_version: current.content_version,
              new_version: newVersion,
              reviewed_at: approval.reviewed_at
            }
          });

          return { id, status: 'PUBLISHED' };
        } else {
          // Status transition to DRAFT, REVIEW, or ARCHIVED
          const isInvalidating = status === 'ARCHIVED' || status === 'DRAFT';
          const targetReviewerId = isInvalidating ? null : (status === 'REVIEW' ? current.reviewer_id : null);
          const targetApprovedHash = isInvalidating ? null : (status === 'REVIEW' ? current.approved_content_hash : null);
          const targetApprovedVersion = isInvalidating ? null : (status === 'REVIEW' ? current.approved_content_version : null);
          const newVersion = isInvalidating ? current.content_version + 1 : current.content_version;

          const updateCount = await tx.$executeRaw`
            UPDATE "education_articles"
            SET
              publication_status = ${status}::publication_status,
              is_published = false,
              published_at = NULL,
              reviewer_id = ${targetReviewerId}::uuid,
              approved_content_hash = ${targetApprovedHash},
              approved_content_version = ${targetApprovedVersion},
              content_version = ${newVersion},
              updated_by = ${req.user!.userId}::uuid,
              updated_at = NOW()
            WHERE id = ${id}::uuid AND content_version = ${current.content_version}
          `;

          if (updateCount === 0) {
            throw new Error('CONCURRENT_MUTATION');
          }

          await recordAuditLog(tx, {
            actorUserId: req.user!.userId,
            action: 'ARTICLE_STATUS_CHANGED',
            entityType: 'public_content',
            entityId: id,
            meta: {
              status,
              old_status: current.publication_status,
              old_version: current.content_version,
              new_version: newVersion
            }
          });

          return { id, status };
        }
      });

      return result;
    } catch (err: any) {
      if (err.message === 'NOT_FOUND') return reply.code(404).send({ message: 'Not found' });
      if (err.message === 'CONCURRENT_MUTATION') {
        return reply.code(409).send({
          message: 'Konten artikel telah berubah bersamaan. Publikasi dibatalkan untuk mencegah bypass penelaahan medis.'
        });
      }
      if (err.statusCode) {
        return reply.code(err.statusCode).send({ message: err.message });
      }
      throw err;
    }
  });
 app.post('/videos/upload-url',async(req,reply)=>{if(!admin(req,reply))return;const b=req.body as any;if(!['video/mp4','video/webm'].includes(b?.content_type)||!Number.isInteger(b?.file_size_bytes)||b.file_size_bytes<1||b.file_size_bytes>524288000)return reply.code(400).send({message:'Invalid video upload'});const ext=b.content_type==='video/mp4'?'mp4':'webm';const key=`education-videos/${randomUUID()}.${ext}`;return{storage_key:key,upload_url:await generateUploadUrl(key,b.content_type)}});
 app.get('/videos',async(req,reply)=>{if(!admin(req,reply))return;const p=pagination(req.query);const [rows,total]=await Promise.all([prisma.education_videos.findMany({skip:p.skip,take:p.limit,orderBy:{updated_at:'desc'},select:{id:true,title:true,description:true,category_id:true,source_type:true,external_url:true,thumbnail_alt:true,duration_seconds:true,language:true,subtitle_text:true,transcript_text:true,speaker_type:true,publication_status:true,updated_at:true}}),prisma.education_videos.count()]);const items=rows.map(row=>Object.fromEntries(Object.entries(row).filter(([,value])=>value!==null)));return{page:p.page,limit:p.limit,total,items}});
 app.get('/consents',async(req,reply)=>{if(!admin(req,reply))return;const p=pagination(req.query);const [items,total]=await Promise.all([prisma.media_consents.findMany({skip:p.skip,take:p.limit,orderBy:{created_at:'desc'},select:{id:true,media_id:true,subject_type:true,subject_reference:true,consent_version:true,status:true,expires_at:true,document_storage_key:true,created_at:true}}),prisma.media_consents.count()]);return{page:p.page,limit:p.limit,total,items}});
 app.post('/videos',async(req,reply)=>{if(!admin(req,reply))return;const b=videoSchema.parse(req.body);if(b.storage_key){const [meta,prefix]=await Promise.all([getObjectMetadata(b.storage_key).catch(()=>null),getObjectPrefix(b.storage_key,16).catch(()=>null)]);const mp4=b.storage_key.endsWith('.mp4')&&meta?.contentType==='video/mp4'&&prefix?.subarray(4,8).toString('ascii')==='ftyp';const webm=b.storage_key.endsWith('.webm')&&meta?.contentType==='video/webm'&&prefix?.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));if(!meta||meta.size!==(b.file_size_bytes??meta.size)||(!mp4&&!webm))return reply.code(400).send({message:'Invalid stored video'})}const item=await prisma.education_videos.create({data:{id:randomUUID(),...b,category_id:b.category_id??null,created_by:req.user!.userId,updated_at:new Date()}});await audited(req.user!.userId,'VIDEO_CREATED',item.id);return reply.code(201).send({id:item.id,status:item.publication_status})});
 app.put('/videos/:id',async(req,reply)=>{if(!admin(req,reply))return;const b=videoSchema.parse(req.body);const item=await prisma.education_videos.update({where:{id:(req.params as any).id},data:{...b,category_id:b.category_id??null,updated_at:new Date()}});await audited(req.user!.userId,'VIDEO_UPDATED',item.id);return{id:item.id,status:item.publication_status}});
  app.put('/videos/:id/status', async (req, reply) => {
    if (!admin(req, reply)) return;
    const { status } = statusSchema.parse(req.body);
    const id = (req.params as any).id;

    // SECTION 4: Block video transition to PUBLISHED until authorized medical review mechanism exists
    if (status === 'PUBLISHED') {
      return reply.code(400).send({
        message: 'Publikasi video ditangguhkan sampai mekanisme persetujuan medis video tersedia secara sah'
      });
    }

    const video = await prisma.education_videos.findUnique({
      where: { id },
      include: { media_consents: true }
    });
    if (!video) return reply.code(404).send({ message: 'Not found' });

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.education_videos.update({
        where: { id },
        data: {
          publication_status: status,
          publisher_id: undefined,
          published_at: undefined,
          updated_at: new Date()
        }
      });

      await recordAuditLog(tx, {
        actorUserId: req.user!.userId,
        action: 'VIDEO_STATUS_CHANGED',
        entityType: 'public_content',
        entityId: id,
        meta: { status }
      });

      return updated;
    });

    return { id: item.id, status: item.publication_status };
  });
 app.post('/videos/:id/consents',async(req,reply)=>{if(!admin(req,reply))return;const b=consentSchema.parse(req.body);const item=await prisma.media_consents.create({data:{id:randomUUID(),media_id:(req.params as any).id,...b,recorded_by:req.user!.userId,updated_at:new Date()}});await audited(req.user!.userId,'MEDIA_CONSENT_CREATED',item.id);return reply.code(201).send({id:item.id,status:item.status})});
 app.post('/consents/:id/document-upload-url',async(req,reply)=>{if(!admin(req,reply))return;const consent=await prisma.media_consents.findUnique({where:{id:(req.params as any).id}});if(!consent)return reply.code(404).send({message:'Not found'});const key=`consents/${randomUUID()}.pdf`;await prisma.media_consents.update({where:{id:consent.id},data:{document_storage_key:key,updated_at:new Date()}});return{upload_url:await generateUploadUrl(key,'application/pdf')}});
 app.get('/consents/:id/document',async(req,reply)=>{if(!admin(req,reply))return;const c=await prisma.media_consents.findUnique({where:{id:(req.params as any).id},select:{document_storage_key:true}});if(!c?.document_storage_key)return reply.code(404).send({message:'Not found'});await audited(req.user!.userId,'CONSENT_DOCUMENT_ACCESSED',(req.params as any).id);return{download_url:await generateDownloadUrl(c.document_storage_key)}});
 app.put('/consents/:id/status',async(req,reply)=>{if(!admin(req,reply))return;const status=(req.body as any)?.status;if(!['APPROVED','WITHDRAWN','EXPIRED','PENDING'].includes(status))return reply.code(400).send({message:'Invalid status'});const old=await prisma.media_consents.findUnique({where:{id:(req.params as any).id}});if(!old)return reply.code(404).send({message:'Not found'});if(status==='APPROVED'){if(!old.document_storage_key)return reply.code(400).send({message:'Consent document required'});const [meta,prefix]=await Promise.all([getObjectMetadata(old.document_storage_key).catch(()=>null),getObjectPrefix(old.document_storage_key,5).catch(()=>null)]);if(!meta||meta.size<5||!prefix?.toString('ascii').startsWith('%PDF-'))return reply.code(400).send({message:'Valid uploaded PDF consent document required'})}const item=await prisma.$transaction(async tx=>{const c=await tx.media_consents.update({where:{id:old.id},data:{status,approved_at:status==='APPROVED'?new Date():old.approved_at,withdrawn_at:status==='WITHDRAWN'?new Date():old.withdrawn_at,reviewed_by:req.user!.userId,updated_at:new Date()}});if(status==='WITHDRAWN')await tx.education_videos.update({where:{id:old.media_id},data:{publication_status:'ARCHIVED',updated_at:new Date()}});return c});await audited(req.user!.userId,'MEDIA_CONSENT_STATUS_CHANGED',item.id,{status});return{id:item.id,status:item.status}});
 app.get('/facilities',async(req,reply)=>{if(!admin(req,reply))return;const p=pagination(req.query);const [items,total]=await Promise.all([prisma.health_facilities.findMany({skip:p.skip,take:p.limit,orderBy:{updated_at:'desc'},include:{facility_services:true,regions:{select:{name:true}}}}),prisma.health_facilities.count()]);return{page:p.page,limit:p.limit,total,items}});
 app.post('/facilities',async(req,reply)=>{if(!admin(req,reply))return;const {services,...b}=facilitySchema.parse(req.body);const item=await prisma.health_facilities.create({data:{id:randomUUID(),...b,created_by:req.user!.userId,updated_by:req.user!.userId,updated_at:new Date(),facility_services:{create:services.map(service=>({service,verified:true}))}}});await audited(req.user!.userId,'FACILITY_CREATED',item.id);return reply.code(201).send({id:item.id,status:item.verification_status})});
 app.put('/facilities/:id',async(req,reply)=>{if(!admin(req,reply))return;const {services,...b}=facilitySchema.parse(req.body);const id=(req.params as any).id;const item=await prisma.$transaction(async tx=>{await tx.facility_services.deleteMany({where:{facility_id:id}});return tx.health_facilities.update({where:{id},data:{...b,updated_by:req.user!.userId,updated_at:new Date(),facility_services:{create:services.map(service=>({service,verified:true}))}}})});await audited(req.user!.userId,'FACILITY_UPDATED',id);return{id:item.id,status:item.verification_status}});
 app.put('/facilities/:id/status',async(req,reply)=>{if(!admin(req,reply))return;const status=(req.body as any)?.status;if(!['DRAFT','UNVERIFIED','VERIFIED','INACTIVE'].includes(status))return reply.code(400).send({message:'Invalid status'});const id=(req.params as any).id;const item=await prisma.health_facilities.update({where:{id},data:{verification_status:status,is_active:status!=='INACTIVE',verified_at:status==='VERIFIED'?new Date():undefined,updated_by:req.user!.userId,updated_at:new Date()}});await audited(req.user!.userId,'FACILITY_STATUS_CHANGED',id,{status});return{id:item.id,status:item.verification_status}});
 app.get('/portal',async(req,reply)=>{if(!admin(req,reply))return;const section=(req.query as any)?.section;const where=section?{section}:{};const items=await prisma.portal_contents.findMany({where,orderBy:[{section:'asc'},{display_order:'asc'},{created_at:'asc'}],include:{article:{select:{id:true,slug:true,title:true,summary:true}},video:{select:{id:true,title:true,description:true}}}});return{items}});
 app.post('/portal',async(req,reply)=>{if(!admin(req,reply))return;const b=portalItemCreateSchema.parse(req.body);const item=await prisma.portal_contents.create({data:{id:randomUUID(),...b,created_by:req.user!.userId,updated_by:req.user!.userId,updated_at:new Date()}});await audited(req.user!.userId,'PORTAL_CONTENT_CREATE',item.id,{section:item.section,title:item.title});return reply.code(201).send(item)});
 app.put('/portal/:id',async(req,reply)=>{if(!admin(req,reply))return;const b=portalItemUpdateSchema.parse(req.body);const id=(req.params as any).id;const item=await prisma.portal_contents.update({where:{id},data:{...b,updated_by:req.user!.userId,updated_at:new Date()}});await audited(req.user!.userId,'PORTAL_CONTENT_UPDATE',item.id,{section:item.section,title:item.title});return item});
 app.put('/portal/:id/status',async(req,reply)=>{if(!admin(req,reply))return;const {status}=statusSchema.parse(req.body);const id=(req.params as any).id;const item=await prisma.portal_contents.update({where:{id},data:{publication_status:status,updated_by:req.user!.userId,updated_at:new Date()}});const auditAction=status==='PUBLISHED'?'PORTAL_CONTENT_PUBLISH':status==='ARCHIVED'?'PORTAL_CONTENT_ARCHIVE':'PORTAL_CONTENT_UPDATE';await audited(req.user!.userId,auditAction,id,{status});return{id:item.id,publication_status:item.publication_status}});
 app.put('/portal/reorder',async(req,reply)=>{if(!admin(req,reply))return;const b=portalReorderSchema.parse(req.body);await prisma.$transaction(b.items.map((i)=>prisma.portal_contents.update({where:{id:i.id},data:{display_order:i.display_order,updated_by:req.user!.userId,updated_at:new Date()}})));await audited(req.user!.userId,'PORTAL_CONTENT_REORDER',b.items[0]?.id??randomUUID(),{section:b.section,count:b.items.length});return{ok:true,section:b.section}});
 app.delete('/portal/:id',async(req,reply)=>{if(!admin(req,reply))return;const id=(req.params as any).id;const item=await prisma.portal_contents.update({where:{id},data:{publication_status:'ARCHIVED',updated_by:req.user!.userId,updated_at:new Date()}});await audited(req.user!.userId,'PORTAL_CONTENT_ARCHIVE',id);return{id:item.id,publication_status:item.publication_status}});
}
