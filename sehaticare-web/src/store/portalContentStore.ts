export type Status = 'Draft' | 'Published' | 'Archived';

export type PortalItem = {
  id: string;
  title: string;
  summary: string;
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

const STORAGE_KEY = 'sehaticare.portalContent.v1';

const seedContent: PortalContent = {
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

const isBrowser = () => typeof window !== 'undefined';

const normalizeContent = (raw?: Partial<PortalContent> | null): PortalContent => ({
  hero: Array.isArray(raw?.hero) ? raw!.hero : seedContent.hero,
  edukasiAwal: Array.isArray(raw?.edukasiAwal) ? raw!.edukasiAwal : seedContent.edukasiAwal,
  video: Array.isArray(raw?.video) ? raw!.video : seedContent.video,
  infografis: Array.isArray(raw?.infografis) ? raw!.infografis : seedContent.infografis,
  faq: Array.isArray(raw?.faq) ? raw!.faq : seedContent.faq,
  carouselImages: Array.isArray(raw?.carouselImages) ? raw!.carouselImages : seedContent.carouselImages
});

const readStoredContent = (): Partial<PortalContent> | null => {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PortalContent>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const loadPortalContent = (): PortalContent => {
  const stored = readStoredContent();
  return normalizeContent(stored);
};

export const savePortalContent = (content: PortalContent) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
};

export const seedDefaultIfEmpty = (): PortalContent => {
  if (!isBrowser()) return seedContent;
  const stored = readStoredContent();
  if (!stored) {
    savePortalContent(seedContent);
    return seedContent;
  }
  const normalized = normalizeContent(stored);
  savePortalContent(normalized);
  return normalized;
};

export const portalContentKey = STORAGE_KEY;
