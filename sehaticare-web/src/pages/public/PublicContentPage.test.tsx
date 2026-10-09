import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { getYouTubeVideoId, PublicContentPage } from './PublicContentPage';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const sampleVideo = {
  id: 'v1',
  title: 'Cara Penularan HIV/AIDS',
  description: 'Ringkas',
  source_type: 'EXTERNAL',
  external_url: 'https://www.youtube.com/watch?v=mLfb3mMNubc',
  subtitle_text: 'Caption mengikuti penerbit.',
  transcript_text: 'Ringkasan isi terverifikasi.'
};

const sampleArticle = {
  title: 'Memahami Perbedaan HIV dan AIDS',
  slug: 'memahami-perbedaan-hiv-dan-aids',
  summary: 'HIV adalah virus sedangkan AIDS adalah kondisi lanjut bila tidak diobati.',
  body_markdown: '## Penjelasan Ilmiah\n\nHIV menyerang sel CD4. Dengan ARV teratur, ODHIV hidup sehat.',
  reading_minutes: 3,
  source_reference: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
  updated_at: '2026-10-09T00:00:00.000Z',
  content_categories: {
    slug: 'dasar-hiv',
    name: 'Dasar HIV'
  }
};

const sampleCompositeArticle = {
  title: 'Ilustrasi Komposit Edukatif: Perjalanan Menuju Tidak Terdeteksi',
  slug: 'ilustrasi-komposit-perjalanan-menuju-u-equals-u',
  summary: 'Rangkuman pengalaman komunitas sebaya menuju viral load tersupresi.',
  body_markdown: '## Refleksi Sebaya\n\nMenyesuaikan diri dengan ARV dan mencapai U=U.',
  reading_minutes: 4,
  source_reference: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids',
  updated_at: '2026-10-09T00:00:00.000Z',
  content_categories: {
    slug: 'dukungan-psikososial',
    name: 'Dukungan Psikososial'
  }
};

test('video carousel loads privacy-enhanced YouTube only after a user action', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
    String(input).includes('/articles') ? json({ items: [] }) : json({ items: [sampleVideo] })
  );
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PublicContentPage />
    </MemoryRouter>
  );
  expect(await screen.findByText('Cara Penularan HIV/AIDS')).toBeInTheDocument();
  expect(document.querySelector('video')).toBeNull();
  expect(document.querySelector('iframe')).toBeNull();
  expect(screen.getByRole('img', { name: /thumbnail video cara penularan hiv\/aids/i })).toHaveAttribute(
    'src',
    'https://i.ytimg.com/vi/mLfb3mMNubc/hqdefault.jpg'
  );
  await user.click(screen.getByRole('button', { name: /putar cara penularan hiv\/aids/i }));
  const frame = screen.getByTitle('Cara Penularan HIV/AIDS');
  expect(frame).toHaveAttribute('src', expect.stringContaining('https://www.youtube-nocookie.com/embed/mLfb3mMNubc'));
  expect(screen.getByRole('link', { name: /lihat ringkasan dan aksesibilitas/i })).toHaveAttribute(
    'href',
    '/edukasi/video/v1'
  );
  expect(screen.getByRole('link', { name: /ke beranda/i })).toHaveAttribute('href', '/');
});

test('video detail exposes accessibility information and summary', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(sampleVideo));
  render(
    <MemoryRouter initialEntries={['/edukasi/video/v1']}>
      <Routes>
        <Route path="/edukasi/video/:videoId" element={<PublicContentPage />} />
      </Routes>
    </MemoryRouter>
  );
  expect(await screen.findByRole('heading', { name: 'Informasi aksesibilitas' })).toBeInTheDocument();
  expect(screen.getByText('Caption mengikuti penerbit.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Ringkasan isi video' })).toBeInTheDocument();
  expect(screen.getByText('Ringkasan isi terverifikasi.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /kembali ke edukasi/i })).toHaveAttribute('href', '/edukasi');
  expect(screen.getByRole('link', { name: /ke beranda/i })).toHaveAttribute('href', '/');
  expect(document.querySelector('iframe')).toBeNull();
});

test('YouTube URL parser accepts supported formats and rejects lookalike hosts', () => {
  expect(getYouTubeVideoId('https://youtu.be/mLfb3mMNubc')).toBe('mLfb3mMNubc');
  expect(getYouTubeVideoId('https://www.youtube.com/shorts/mLfb3mMNubc')).toBe('mLfb3mMNubc');
  expect(getYouTubeVideoId('https://youtube.example/watch?v=mLfb3mMNubc')).toBeNull();
});

test('renders educational index with U=U explainer, myths vs facts, FAQ, and articles', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/articles')) return json({ items: [sampleArticle, sampleCompositeArticle] });
    if (url.includes('/videos')) return json({ items: [sampleVideo] });
    if (url.includes('/content-categories')) {
      return json({
        items: [
          { slug: 'dasar-hiv', name: 'Dasar HIV' },
          { slug: 'pengobatan-hiv', name: 'Pengobatan HIV' }
        ]
      });
    }
    return json({ items: [] });
  });

  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/edukasi']}>
      <PublicContentPage />
    </MemoryRouter>
  );

  // U=U Explainer Section
  expect(await screen.findByRole('heading', { name: /U=U: Undetectable = Untransmittable/i })).toBeInTheDocument();
  expect(screen.getByText(/Konsensus Ilmiah Global/i)).toBeInTheDocument();

  // Articles & Badges
  expect(screen.getByText('Memahami Perbedaan HIV dan AIDS')).toBeInTheDocument();
  expect(screen.getByText('🏷️ Ilustrasi Komposit')).toBeInTheDocument();
  expect(screen.getByText('Ilustrasi Komposit Edukatif: Perjalanan Menuju Tidak Terdeteksi')).toBeInTheDocument();

  // Category filter buttons
  expect(screen.getByRole('tab', { name: 'Semua Topik' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Dasar HIV' })).toBeInTheDocument();

  // Interactive Myths vs Facts
  expect(screen.getByRole('heading', { name: /Mitos vs Fakta Seputar HIV/i })).toBeInTheDocument();
  // Myth 1 is open by default
  expect(screen.getByText(/HIV adalah kondisi kronis yang dapat dikelola dengan terapi ARV/i)).toBeInTheDocument();
  // Click another myth to expand it
  const myth2Button = screen.getByRole('button', { name: /HIV dapat menular lewat jabat tangan, alat makan, atau gigitan nyamuk/i });
  await user.click(myth2Button);
  expect(screen.getByText(/Air liur, keringat, dan sentuhan fisik kasual tidak menularkan HIV/i)).toBeInTheDocument();

  // Interactive FAQ Accordion
  expect(screen.getByRole('heading', { name: /Pertanyaan yang Sering Diajukan \(FAQ\)/i })).toBeInTheDocument();
  const faq1Button = screen.getByRole('button', { name: /Apa perbedaan mendasar antara HIV dan AIDS\?/i });
  await user.click(faq1Button);
  expect(screen.getByText(/HIV adalah nama virus/i)).toBeInTheDocument();

  // Service Navigation CTAs
  expect(screen.getByText('Curhat Tanpa Nama')).toBeInTheDocument();
  expect(screen.getByText('Fasilitas & Tes VCT')).toBeInTheDocument();
  expect(screen.getByText('Darurat Paparan (PEP)')).toBeInTheDocument();
});

test('article detail view renders medical disclaimer, source reference, and composite banner when applicable', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(sampleCompositeArticle));

  render(
    <MemoryRouter initialEntries={['/edukasi/ilustrasi-komposit-perjalanan-menuju-u-equals-u']}>
      <Routes>
        <Route path="/edukasi/:slug" element={<PublicContentPage />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText('Ilustrasi Komposit Edukatif: Perjalanan Menuju Tidak Terdeteksi')).toBeInTheDocument();
  // Medical Disclaimer banner
  expect(screen.getByText(/Pemberitahuan Medis:/i)).toBeInTheDocument();
  expect(
    screen.getByText(/Materi ini disusun untuk tujuan edukasi kesehatan masyarakat dan tidak menggantikan konsultasi langsung/i)
  ).toBeInTheDocument();

  // Composite Peer Story notification
  expect(screen.getByText(/🏷️ Ilustrasi Komposit Edukatif/i)).toBeInTheDocument();
  expect(screen.getByText(/Tulisan ini dirangkum dari berbagai pola pengalaman nyata komunitas dampingan/i)).toBeInTheDocument();

  // Authoritative Source Reference
  expect(screen.getByText(/Sumber Referensi Resmi:/i)).toBeInTheDocument();
  const sourceLink = screen.getByRole('link', { name: 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids' });
  expect(sourceLink).toHaveAttribute('href', 'https://www.who.int/news-room/fact-sheets/detail/hiv-aids');
  expect(sourceLink).toHaveAttribute('target', '_blank');

  // Consultation CTA at article footer
  expect(screen.getByText(/Butuh Ruang untuk Bercerita Lebih Lanjut\?/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Curhat Anonim ke Konselor/i })).toHaveAttribute('href', '/login');
});

test('AG-11A public UI copy reflects medical precision and legal confidentiality boundaries', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/articles')) return json({ items: [] });
    if (url.includes('/videos')) return json({ items: [] });
    if (url.includes('/content-categories')) return json({ items: [] });
    return json({ items: [] });
  });

  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/edukasi']}>
      <PublicContentPage />
    </MemoryRouter>
  );

  // Wait for loading to finish and U=U explainer to appear
  expect(await screen.findByRole('heading', { name: /U=U: Undetectable = Untransmittable/i })).toBeInTheDocument();

  // U=U explicit sexual transmission scope and suppression threshold
  expect(
    screen.getByText(/tidak dapat menularkan HIV kepada pasangan seksualnya/i)
  ).toBeInTheDocument();
  expect(screen.getByText(/Khusus Transmisi Seksual/i)).toBeInTheDocument();
  expect(screen.getByText(/tidak berlaku tanpa kualifikasi untuk penularan darah atau jarum suntik/i)).toBeInTheDocument();

  // FAQ PEP test
  const faq2Button = screen.getByRole('button', { name: /Apa yang harus dilakukan jika saya baru saja terpapar dalam kurun <72 jam\?/i });
  await user.click(faq2Button);
  expect(screen.getByText(/idealnya <24 jam dan paling lambat 72 jam setelah paparan/i)).toBeInTheDocument();
  expect(screen.getByText(/dikonsumsi selama 28 hari penuh/i)).toBeInTheDocument();

  // FAQ Confidentiality test
  const faq4Button = screen.getByRole('button', { name: /Bagaimana kerahasiaan data medis saya dilindungi\?/i });
  await user.click(faq4Button);
  expect(screen.getByText(/UU No\. 17 Tahun 2023 tentang Kesehatan/i)).toBeInTheDocument();
  expect(screen.getByText(/Permenkes No\. 24 Tahun 2022 \(Pasal 28\)/i)).toBeInTheDocument();
  expect(screen.getByText(/peramban web tidak menghapus riwayat penelusuran secara otomatis/i)).toBeInTheDocument();
});
