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
    reviewed_at: Date;
    notes: string | null;
    reviewer_name: string;
  };
}

/**
 * Verifies that an article has valid, authoritative clinical approval:
 * 1. An approval record exists with decision = 'APPROVED'
 * 2. The approved content_hash matches the CURRENT canonical hash of the article
 * 3. The reviewer was and remains an active, verified DOKTER
 */
export async function getArticleLatestValidApproval(
  articleId: string,
  currentHash: string
): Promise<ValidApprovalResult> {
  const latestApproval = await prisma.article_clinical_reviews.findFirst({
    where: {
      article_id: articleId,
      decision: 'APPROVED',
      content_hash: currentHash
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

  if (!latestApproval) {
    return {
      valid: false,
      statusCode: 400,
      message: 'Persetujuan klinis dokter terverifikasi diperlukan sebelum artikel dapat diterbitkan'
    };
  }

  const reviewer = latestApproval.reviewer;
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
      id: latestApproval.id,
      article_id: latestApproval.article_id,
      reviewer_id: latestApproval.reviewer_id,
      decision: latestApproval.decision,
      content_hash: latestApproval.content_hash,
      reviewed_at: latestApproval.reviewed_at,
      notes: latestApproval.notes,
      reviewer_name: reviewer.full_name
    }
  };
}

