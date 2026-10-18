import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/patterns';

interface ArticleItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body_markdown: string;
  category: { slug: string; name: string } | null;
  language: string;
  source_reference: string | null;
  reading_minutes: number;
  featured: boolean;
  publication_status: string;
  is_published: boolean;
  current_content_hash: string;
  approved_content_hash: string | null;
  is_clinically_approved: boolean;
  latest_review?: {
    id: string;
    decision: string;
    content_hash: string;
    reviewed_at: string;
    notes: string | null;
  } | null;
}

interface ArticleDetail extends ArticleItem {
  reviews_history: Array<{
    id: string;
    decision: string;
    content_hash: string;
    source_reference: string | null;
    notes: string | null;
    reviewed_at: string;
    reviewer_name: string;
  }>;
}

export function DoctorContentReviewPage() {
  const { token, handleUnauthorized } = useAuth();
  const [items, setItems] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleDetail | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const options = useMemo(() => ({ token, onUnauthorized: handleUnauthorized }), [token, handleUnauthorized]);

  const loadArticles = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const statusParam = filter === 'ALL' ? '' : `status=${filter}`;
      const params = new URLSearchParams();
      if (statusParam) params.set('status', filter);
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      const response = await apiFetch<{ items: ArticleItem[]; total: number }>(
        `/doctor/content-reviews?${params.toString()}`,
        {},
        options
      );
      setItems(response.items);
      setTotal(response.total);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal memuat daftar artikel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadArticles();
  }, [filter, page, token]);

  const handleFilterChange = (newFilter: 'ALL' | 'REVIEW' | 'PUBLISHED') => {
    setFilter(newFilter);
    setPage(1);
  };

  const inspectArticle = async (id: string) => {
    setInspectLoading(true);
    setMessage(null);
    setNotes('');
    try {
      const detail = await apiFetch<ArticleDetail>(`/doctor/content-reviews/${id}`, {}, options);
      setSelectedArticle(detail);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal memuat detail artikel.');
    } finally {
      setInspectLoading(false);
    }
  };

  const handleDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!selectedArticle) return;
    if (decision === 'REJECTED' && !notes.trim()) {
      if (!window.confirm('Tolak draf artikel ini tanpa catatan penelaahan klinis?')) return;
    }

    setActionLoading(true);
    setMessage(null);
    try {
      await apiFetch(
        `/doctor/content-reviews/${selectedArticle.id}`,
        {
          method: 'POST',
          body: JSON.stringify({
            decision,
            content_hash: selectedArticle.current_content_hash,
            notes: notes.trim() || undefined
          })
        },
        options
      );
      setMessage(
        decision === 'APPROVED'
          ? 'Persetujuan telaah medis klinis berhasil disimpan. Admin berwenang kini dapat menerbitkan artikel ini.'
          : 'Artikel ditolak dan dikembalikan ke status DRAFT untuk revisi editorial.'
      );
      setSelectedArticle(null);
      await loadArticles();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal mengirim keputusan telaah.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="page-shell space-y-6">
      <PageHeader
        eyebrow="Tata Kelola Konten Klinis"
        title="Penelaahan Medis Edukasi Publik"
        description="Verifikasi akurasi medis dan keabsahan rujukan ilmiah sebelum artikel kesehatan HIV/AIDS diterbitkan ke publik."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadArticles()} disabled={loading}>
              Segarkan
            </Button>
          </div>
        }
      />

      {message && (
        <div
          role="status"
          className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900"
        >
          {message}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={filter === 'REVIEW' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleFilterChange('REVIEW')}
        >
          Perlu Telaah (REVIEW)
        </Button>
        <Button
          variant={filter === 'PUBLISHED' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleFilterChange('PUBLISHED')}
        >
          Sudah Terbit (PUBLISHED)
        </Button>
        <Button
          variant={filter === 'ALL' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleFilterChange('ALL')}
        >
          Semua Status
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Article List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Antrean Telaah ({total})</CardTitle>
              {total > pageSize && (
                <span className="text-xs text-slate-500">
                  Hal. {page} dari {Math.ceil(total / pageSize) || 1}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-slate-500">Memuat artikel...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500">Tidak ada artikel dalam kategori ini.</p>
            ) : (
              items.map((art) => (
                <div
                  key={art.id}
                  className={`rounded-xl border p-4 transition ${
                    selectedArticle?.id === art.id
                      ? 'border-brand bg-sky-50/50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-slate-900">{art.title}</h3>
                      <p className="text-xs text-slate-500">
                        Kategori: {art.category?.name ?? 'Umum'} · {art.reading_minutes} menit baca
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{art.publication_status}</Badge>
                      {art.is_clinically_approved ? (
                        <Badge variant="success">Telaah Sah</Badge>
                      ) : (
                        <Badge variant="outline">Belum Disetujui</Badge>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs text-slate-600">{art.summary}</p>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                    <span className="font-mono text-[10px] text-slate-400">
                      Hash: {art.current_content_hash.slice(0, 12)}...
                    </span>
                    <Button
                      size="sm"
                      variant={selectedArticle?.id === art.id ? 'default' : 'outline'}
                      onClick={() => void inspectArticle(art.id)}
                      disabled={inspectLoading}
                    >
                      {selectedArticle?.id === art.id ? 'Sedang Ditinjau' : 'Tinjau Medis'}
                    </Button>
                  </div>
                </div>
              ))
            )}

            {/* Pagination Controls */}
            {total > pageSize && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  Halaman Sebelumnya
                </Button>
                <span className="text-xs text-slate-500">
                  {page} / {Math.ceil(total / pageSize)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * pageSize >= total || loading}
                >
                  Halaman Berikutnya
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inspection & Review Form */}
        <Card>
          <CardHeader>
            <CardTitle>Inspeksi & Keputusan Medis</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedArticle ? (
              <div className="py-12 text-center text-sm text-slate-400">
                Pilih salah satu artikel di sebelah kiri untuk melihat konten lengkap dan memberikan telaah klinis.
              </div>
            ) : inspectLoading ? (
              <p className="text-sm text-slate-500">Memuat rincian artikel...</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedArticle.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Slug: <span className="font-mono">{selectedArticle.slug}</span>
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <p className="font-semibold text-slate-700">Referensi Sumber Ilmiah:</p>
                  {selectedArticle.source_reference ? (
                    <a
                      href={selectedArticle.source_reference}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-sky-700 underline hover:text-sky-900"
                    >
                      {selectedArticle.source_reference}
                    </a>
                  ) : (
                    <span className="text-rose-600">Tidak ada sumber referensi resmi terdaftar.</span>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-700">Ringkasan:</p>
                  <p className="mt-1 rounded border bg-white p-2 text-xs text-slate-700">
                    {selectedArticle.summary}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-700">Isi Konten Artikel (Markdown):</p>
                  <pre className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap rounded border bg-slate-50 p-3 font-mono text-xs text-slate-800">
                    {selectedArticle.body_markdown}
                  </pre>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <p className="font-semibold text-slate-700">Canonical Content Hash:</p>
                  <p className="font-mono text-[11px] text-slate-600 break-all">
                    {selectedArticle.current_content_hash}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Persetujuan Anda akan mengunci versi konten dengan hash ini secara kriptografis. Perubahan isi
                    oleh admin otomatis membatalkan persetujuan ini.
                  </p>
                </div>

                {selectedArticle.reviews_history.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Riwayat Penelaahan Medis:</p>
                    <div className="mt-1 max-h-36 space-y-2 overflow-y-auto">
                      {selectedArticle.reviews_history.map((rev) => (
                        <div key={rev.id} className="rounded border bg-white p-2 text-xs">
                          <div className="flex items-center justify-between font-semibold">
                            <span>{rev.reviewer_name}</span>
                            <Badge variant={rev.decision === 'APPROVED' ? 'success' : 'outline'}>
                              {rev.decision}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {new Date(rev.reviewed_at).toLocaleString('id-ID')}
                          </p>
                          {rev.notes && <p className="mt-1 text-slate-600">{rev.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-200 pt-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Catatan Telaah Klinis (Opsional):
                    <textarea
                      className="mt-1 w-full rounded border bg-white p-2 text-xs text-slate-800"
                      rows={3}
                      placeholder="Tuliskan catatan verifikasi ilmiah, kesesuaian pedoman Kemenkes/WHO, atau alasan revisi..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => void handleDecision('APPROVED')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Menyimpan...' : 'Setujui Medis (Approve)'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDecision('REJECTED')}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Menyimpan...' : 'Tolak / Minta Revisi (Reject)'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedArticle(null)}
                      disabled={actionLoading}
                    >
                      Tutup
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
