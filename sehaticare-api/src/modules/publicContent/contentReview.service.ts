import { createHash } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { isAuthoritativeSourceUrl } from './content.validators';

export interface ArticleContentInput {
  title: string;
  summary: string;
  body_markdown: string;
  category_id?: string | null;
  language?: string | null;
  source_reference?: string | null;
  thumbnail_key?: string | null;
  thumbnail_alt?: string | null;
}

/**
 * Computes a deterministic canonical SHA-256 cryptographic hash of all
 * medically and publicly significant article content fields.
 */
export function computeArticleContentHash(article: ArticleContentInput): string {
  const canonicalPayload = {
    title: (article.title || '').trim(),
    summary: (article.summary || '').trim(),
    body_markdown: (article.body_markdown || '').replace(/\r\n/g, '\n').trim(),
    category_id: (article.category_id || '').trim(),
    language: (article.language || 'id').trim().toLowerCase(),
    source_reference: (article.source_reference || '').trim(),
    thumbnail_key: (article.thumbnail_key || '').trim(),
    thumbnail_alt: (article.thumbnail_alt || '').trim()
  };

  return createHash('sha256')
    .update(JSON.stringify(canonicalPayload), 'utf8')
    .digest('hex');
}

export interface ReviewerEligibilityResult {
  eligible: boolean;
  statusCode: number;
  message: string;
  doctorProfile?: {
    puskesmas_name: string | null;
    str_number: string | null;
    verification_status: string;
  };
}

/**
 * Verifies that the caller is an active, authenticated user with role DOKTER
 * and a linked doctor_profiles record with verification_status = VERIFIED.
 * Rejects ADMIN, PASIEN, COUNSELOR, COMPANION, AI, unverified doctors, or inactive accounts.
 */
export async function verifyDoctorReviewerEligibility(
  userId: string
): Promise<ReviewerEligibilityResult> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    include: {
      doctor_profiles_doctor_profiles_user_idTousers: true
    }
  });

  if (!user) {
    return { eligible: false, statusCode: 401, message: 'Autentikasi diperlukan' };
  }

  if (!user.is_active) {
    return { eligible: false, statusCode: 403, message: 'Akun tenaga medis tidak aktif' };
  }

  if (user.role !== 'DOKTER') {
    return {
      eligible: false,
      statusCode: 403,
      message: 'Hanya dokter yang dapat melakukan penelaahan medis klinis'
    };
  }

  const profile = user.doctor_profiles_doctor_profiles_user_idTousers;
  if (!profile || profile.verification_status !== 'VERIFIED') {
    return {
      eligible: false,
      statusCode: 403,
      message: 'Profil dokter belum terverifikasi secara resmi'
    };
  }

  return {
    eligible: true,
    statusCode: 200,
    message: 'Dokter terverifikasi memenuhi syarat',
    doctorProfile: {
      puskesmas_name: profile.puskesmas_name,
      str_number: profile.str_number,
      verification_status: profile.verification_status
    }
  };
}

export interface ValidApprovalResult {
  valid: boolean;
  statusCode: number;
  message: string;
  approval?: {
    id: string;
    article_id: string;
    reviewer_id: string;
    decision: string;
    content_hash: string;
    content_version: number;
    reviewed_at: Date;
    notes: string | null;
    reviewer_name: string;
  };
}

/**
 * Shared evaluation logic for whether an article is currently clinically approved.
 * Guaranteed consistent across admin list, doctor list, detail, and publish gates.
 */
export function isArticleClinicallyApproved(
  article: {
    content_version?: number;
    approved_content_version?: number | null;
    approved_content_hash?: string | null;
  },
  latestReview: {
    decision: string;
    content_version?: number;
    content_hash: string;
  } | null,
  currentHash: string
): boolean {
  if (!article.approved_content_hash || article.approved_content_hash !== currentHash) {
    return false;
  }
  const articleVersion = article.content_version ?? 1;
  const approvedVersion = article.approved_content_version ?? 1;
  if (articleVersion !== approvedVersion) {
    return false;
  }
  if (!latestReview) {
    return false;
  }
  if (latestReview.decision !== 'APPROVED') {
    return false;
  }
  const reviewVersion = latestReview.content_version ?? 1;
  if (reviewVersion !== articleVersion) {
    return false;
  }
  if (latestReview.content_hash !== currentHash) {
    return false;
  }
  return true;
}

/**
 * Verifies that an article has valid, authoritative clinical approval:
 * 1. An approval record exists on the ACTIVE content_version.
 * 2. The LATEST decision on this active version is 'APPROVED' (not REJECTED).
 * 3. The approved content_hash matches the CURRENT canonical hash of the article.
 * 4. The reviewer was and remains an active, verified DOKTER.
 */
export async function getArticleLatestValidApproval(
  articleId: string,
  currentHash: string,
  activeVersion: number = 1,
  tx?: any
): Promise<ValidApprovalResult> {
  const db = tx ?? prisma;

  // Retrieve the latest review specifically on the active content version
  const latestReview = await db.article_clinical_reviews.findFirst({
    where: {
      article_id: articleId,
      content_version: activeVersion
    },
    orderBy: { reviewed_at: 'desc' },
    include: {
      reviewer: {
        include: {
          doctor_profiles_doctor_profiles_user_idTousers: true
        }
      }
    }
  });

  if (!latestReview) {
    return {
      valid: false,
      statusCode: 400,
      message: 'Persetujuan klinis dokter terverifikasi diperlukan untuk versi artikel saat ini sebelum dapat diterbitkan'
    };
  }

  // The latest decision on the active revision is authoritative
  if (latestReview.decision !== 'APPROVED') {
    return {
      valid: false,
      statusCode: 400,
      message: 'Keputusan telaah klinis terkini adalah penolakan (REJECTED). Diperlukan persetujuan klinis baru sebelum publikasi.'
    };
  }

  if (latestReview.content_hash !== currentHash) {
    return {
      valid: false,
      statusCode: 400,
      message: 'Hash konten yang disetujui tidak cocok dengan konten artikel saat ini. Persetujuan klinis dokter terverifikasi diperlukan sebelum artikel dapat diterbitkan.'
    };
  }

  const reviewer = latestReview.reviewer;
  if (!reviewer || !reviewer.is_active || reviewer.role !== 'DOKTER') {
    return {
      valid: false,
      statusCode: 403,
      message: 'Persetujuan medis tidak lagi valid: akun dokter penelaah tidak aktif atau peran berubah'
    };
  }

  const doctorProfile = reviewer.doctor_profiles_doctor_profiles_user_idTousers;
  if (!doctorProfile || doctorProfile.verification_status !== 'VERIFIED') {
    return {
      valid: false,
      statusCode: 403,
      message: 'Persetujuan medis tidak lagi valid: verifikasi profesi dokter penelaah tidak terverifikasi'
    };
  }

  return {
    valid: true,
    statusCode: 200,
    message: 'Persetujuan medis klinis sah',
    approval: {
      id: latestReview.id,
      article_id: latestReview.article_id,
      reviewer_id: latestReview.reviewer_id,
      decision: latestReview.decision,
      content_hash: latestReview.content_hash,
      content_version: latestReview.content_version ?? activeVersion,
      reviewed_at: latestReview.reviewed_at,
      notes: latestReview.notes,
      reviewer_name: reviewer.full_name
    }
  };
}

