import { apiFetch } from '../api/client';

export type Status = 'Draft' | 'Published' | 'Archived';

export type PortalItem = {
  id: string;
  title: string;
  summary: string;
  href?: string;
  mediaUrl?: string;
  status: Status;
  order: number;
  updatedAt: string;
};

export type CarouselImage = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  status: Status;
  order: number;
  updatedAt: string;
};

export type PortalContent = {
  hero: PortalItem[];
  edukasiAwal: PortalItem[];
  video: PortalItem[];
  infografis: PortalItem[];
  faq: PortalItem[];
  carouselImages: CarouselImage[];
};

export type SectionKey = keyof PortalContent;

const STORAGE_KEY = 'sehaticare.portalContent.v1';
export const portalContentKey = STORAGE_KEY;

export const seedContent: PortalContent = {
  hero: [
    {
      id: 'hero-1',
      title: 'Hero utama SEHATiCare',
      summary: 'Judul utama, subjudul, dan CTA login.',
      status: 'Published',
      order: 1,
      updatedAt: '2026-01-18T10:30:00Z'
    }
  ],
  edukasiAwal: [
    {
      id: 'edu-1',
      title: 'Edukasi Awal HIV',
      summary: 'Panduan ringkas untuk memahami langkah aman pertama.',
      status: 'Published',
      order: 1,
      updatedAt: '2026-01-17T09:15:00Z'
    },
    {
      id: 'edu-2',
      title: 'Pencegahan & Proteksi',
      summary: 'Informasi praktis untuk menjaga diri dan pasangan.',
      status: 'Draft',
      order: 2,
      updatedAt: '2026-01-16T08:10:00Z'
    }
  ],
  video: [
    {
      id: 'vid-1',
      title: 'Video edukasi singkat',
      summary: 'Cuplikan 2-3 menit untuk memahami poin utama.',
      status: 'Draft',
      order: 1,
      updatedAt: '2026-01-15T12:00:00Z'
    }
  ],
  infografis: [
    {
      id: 'media-1',
      title: 'Infografis dasar HIV',
      summary: 'Ringkasan visual yang mudah dibagikan.',
      status: 'Published',
      order: 1,
      updatedAt: '2026-01-14T07:45:00Z'
    }
  ],
  faq: [
    {
      id: 'faq-1',
      title: 'Apakah data saya aman?',
      summary: 'SEHATiCare menjaga privasi dan kerahasiaan data pengguna.',
      status: 'Published',
      order: 1,
      updatedAt: '2026-01-13T06:20:00Z'
    },
    {
      id: 'faq-2',
      title: 'Bagaimana memulai konsultasi?',
      summary: 'Login terlebih dahulu, lalu pilih menu konsultasi.',
      status: 'Published',
      order: 2,
      updatedAt: '2026-01-13T06:25:00Z'
    }
  ],
  carouselImages: [
    {
      id: 'carousel-1',
      title: 'Sorotan Edukasi',
      imageUrl:
        'https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?auto=format&fit=crop&w=1200&q=80',
      linkUrl: '/edukasi',
      status: 'Published',
      order: 1,
      updatedAt: '2026-01-18T08:30:00Z'
    },
    {
      id: 'carousel-2',
      title: 'Dukungan Emosional',
      imageUrl:
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
      linkUrl: '/edukasi',
      status: 'Published',
      order: 2,
      updatedAt: '2026-01-18T08:32:00Z'
    }
  ]
};

export const cleanupLegacyPortalStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem('sehaticare.portalContent');
  } catch {
    // ignore
  }
};

/**
 * Legacy loader kept for backward compatibility and test mock safety.
 * Purges legacy storage and returns the safe static fallback.
 */
export const loadPortalContent = (): PortalContent => {
  cleanupLegacyPortalStorage();
  return seedContent;
};

/**
 * Legacy saver - localStorage persistence removed in AG-01 in favor of backend API.
 */
export const savePortalContent = (_content: PortalContent) => {
  cleanupLegacyPortalStorage();
};

export const seedDefaultIfEmpty = (): PortalContent => {
  cleanupLegacyPortalStorage();
  return seedContent;
};

export type AdminPortalItemDto = {
  id: string;
  section: SectionKey;
  title: string;
  summary: string;
  status: Status;
  order: number;
  imageUrl?: string;
  linkUrl?: string;
  mediaUrl?: string;
  articleId?: string;
  videoId?: string;
  createdAt: string;
  updatedAt: string;
};

export async function fetchPublicPortalContent(): Promise<PortalContent> {
  cleanupLegacyPortalStorage();
  try {
    const res = await apiFetch<{ items: unknown[]; sections: PortalContent }>('/public/portal');
    if (res?.sections) {
      return {
        hero: Array.isArray(res.sections.hero) ? res.sections.hero : [],
        edukasiAwal: Array.isArray(res.sections.edukasiAwal) ? res.sections.edukasiAwal : [],
        video: Array.isArray(res.sections.video) ? res.sections.video : [],
        infografis: Array.isArray(res.sections.infografis) ? res.sections.infografis : [],
        faq: Array.isArray(res.sections.faq) ? res.sections.faq : [],
        carouselImages: Array.isArray(res.sections.carouselImages) ? res.sections.carouselImages : []
      };
    }
    return seedContent;
  } catch (err) {
    console.warn('[PortalCMS] Failed to fetch public portal content, using safe fallback:', err);
    return seedContent;
  }
}

export async function fetchAdminPortalContent(token?: string | null): Promise<PortalContent> {
  cleanupLegacyPortalStorage();
  const res = await apiFetch<{ items: AdminPortalItemDto[] }>(
    '/admin/content/portal',
    {},
    { token }
  );
  const result: PortalContent = {
    hero: [],
    edukasiAwal: [],
    video: [],
    infografis: [],
    faq: [],
    carouselImages: []
  };

  for (const it of res.items) {
    if (it.section === 'carouselImages') {
      result.carouselImages.push({
        id: it.id,
        title: it.title,
        imageUrl: it.imageUrl ?? '',
        linkUrl: it.linkUrl,
        status: it.status,
        order: it.order,
        updatedAt: it.updatedAt
      });
    } else if (it.section in result) {
      result[it.section].push({
        id: it.id,
        title: it.title,
        summary: it.summary ?? '',
        mediaUrl: it.mediaUrl,
        href: it.linkUrl,
        status: it.status,
        order: it.order,
        updatedAt: it.updatedAt
      });
    }
  }

  (Object.keys(result) as SectionKey[]).forEach((key) => {
    result[key].sort((a, b) => a.order - b.order);
  });

  return result;
}

export async function createAdminPortalItem(
  token: string | null | undefined,
  data: {
    section: SectionKey;
    title: string;
    summary?: string;
    status?: Status;
    display_order?: number;
    image_url?: string;
    link_url?: string;
    media_url?: string;
    article_id?: string;
    video_id?: string;
  }
) {
  return apiFetch<{ item: AdminPortalItemDto }>(
    '/admin/content/portal',
    {
      method: 'POST',
      body: JSON.stringify(data)
    },
    { token }
  );
}

export async function updateAdminPortalItem(
  token: string | null | undefined,
  id: string,
  data: {
    section?: SectionKey;
    title?: string;
    summary?: string;
    status?: Status;
    display_order?: number;
    image_url?: string;
    link_url?: string;
    media_url?: string;
    article_id?: string;
    video_id?: string;
  }
) {
  return apiFetch<{ item: AdminPortalItemDto }>(
    `/admin/content/portal/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(data)
    },
    { token }
  );
}

export async function updateAdminPortalStatus(
  token: string | null | undefined,
  id: string,
  status: Status
) {
  return apiFetch<{ item: AdminPortalItemDto }>(
    `/admin/content/portal/${encodeURIComponent(id)}/status`,
    {
      method: 'PUT',
      body: JSON.stringify({ status })
    },
    { token }
  );
}

export async function reorderAdminPortalItems(
  token: string | null | undefined,
  items: { id: string; display_order: number }[]
) {
  return apiFetch<{ success: boolean; count: number }>(
    '/admin/content/portal/reorder',
    {
      method: 'PUT',
      body: JSON.stringify({ items })
    },
    { token }
  );
}

export async function deleteAdminPortalItem(
  token: string | null | undefined,
  id: string
) {
  return apiFetch<{ success: boolean; item: AdminPortalItemDto }>(
    `/admin/content/portal/${encodeURIComponent(id)}`,
    {
      method: 'DELETE'
    },
    { token }
  );
}
