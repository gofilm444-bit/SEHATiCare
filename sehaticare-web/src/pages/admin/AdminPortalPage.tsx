import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  PortalCarousel,
  PortalCardSection,
  PortalFaqSection,
  buildAutoCarouselItems,
  getPublishedItems
} from '../../components/portal/PortalContentSections';
import {
  createAdminPortalItem,
  deleteAdminPortalItem,
  fetchAdminPortalContent,
  reorderAdminPortalItems,
  seedContent,
  updateAdminPortalItem,
  updateAdminPortalStatus,
  type CarouselImage,
  type PortalContent,
  type PortalItem,
  type Status
} from '../../store/portalContentStore';

type SectionKey = keyof PortalContent;

type BaseItem = PortalItem | CarouselImage;

type FormState = {
  title: string;
  summary: string;
  status: Status;
  imageUrl: string;
  linkUrl: string;
  mediaUrl: string;
};

const sections: { key: SectionKey; label: string; description: string }[] = [
  { key: 'hero', label: 'Banner/Hero', description: 'Konten utama di bagian atas portal.' },
  { key: 'carouselImages', label: 'Carousel Gambar', description: 'Gambar sorotan di bagian atas edukasi.' },
  { key: 'edukasiAwal', label: 'Edukasi Awal', description: 'Ringkasan materi untuk pengunjung.' },
  { key: 'video', label: 'Video Edukasi', description: 'Konten video atau cuplikan edukasi.' },
  { key: 'infografis', label: 'Foto/Infografis', description: 'Konten visual pendukung edukasi.' },
  { key: 'faq', label: 'FAQ Portal', description: 'Pertanyaan umum untuk pengunjung.' }
];

const statusStyles: Record<Status, string> = {
  Draft: 'border-amber-200 bg-amber-50 text-amber-700',
  Published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Archived: 'border-slate-200 bg-slate-50 text-slate-600'
};

const emptyForm: FormState = {
  title: '',
  summary: '',
  status: 'Draft',
  imageUrl: '',
  linkUrl: '',
  mediaUrl: ''
};

export function AdminPortalPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<SectionKey>('hero');
  const [content, setContent] = useState<PortalContent>(() => seedContent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchAdminPortalContent(token);
      setContent(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal memuat konten portal dari server.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeSection = useMemo(
    () => sections.find((section) => section.key === activeTab) ?? sections[0],
    [activeTab]
  );

  const isCarousel = activeTab === 'carouselImages';
  const isMediaUploadTab = activeTab === 'video' || activeTab === 'infografis';
  const mediaUploadLabel = activeTab === 'video' ? 'Upload video' : 'Upload gambar';
  const mediaAccept = activeTab === 'video' ? 'video/*' : 'image/*';

  const items = useMemo<BaseItem[]>(() => {
    const current = content[activeTab] ?? [];
    return [...current].sort((a, b) => a.order - b.order);
  }, [activeTab, content]);

  const manualCarouselPreview = useMemo(
    () => getPublishedItems(content.carouselImages),
    [content]
  );
  const autoCarouselPreview = useMemo(
    () => buildAutoCarouselItems(content),
    [content]
  );
  const carouselPreview = useMemo(() => {
    if (manualCarouselPreview.length === 0) return autoCarouselPreview;
    const titles = new Set(manualCarouselPreview.map((item) => item.title));
    return manualCarouselPreview.concat(
      autoCarouselPreview.filter((item) => !titles.has(item.title))
    );
  }, [autoCarouselPreview, manualCarouselPreview]);
  const edukasiPreview = useMemo(() => getPublishedItems(content.edukasiAwal), [content]);
  const faqPreview = useMemo(() => getPublishedItems(content.faq), [content]);

  const openCreate = () => {
    setEditingId(null);
    setFormState(emptyForm);
    setErrorMessage(null);
    setSuccessMessage(null);
    setModalOpen(true);
  };

  const openEdit = (item: BaseItem) => {
    setEditingId(item.id);
    setFormState({
      title: item.title,
      summary: 'summary' in item ? item.summary : '',
      status: item.status,
      imageUrl: 'imageUrl' in item ? item.imageUrl : '',
      linkUrl: 'linkUrl' in item ? item.linkUrl ?? '' : '',
      mediaUrl: 'mediaUrl' in item ? item.mediaUrl ?? '' : ''
    });
    setErrorMessage(null);
    setSuccessMessage(null);
    setModalOpen(true);
  };

  const handleFileChange = (field: 'imageUrl' | 'mediaUrl') => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (result) {
          setFormState((prev) => ({ ...prev, [field]: result }));
        }
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    };
  };

  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (!editingId) {
        if (isCarousel) {
          await createAdminPortalItem(token, {
            section: activeTab,
            title: formState.title.trim() || 'Tanpa judul',
            image_url: formState.imageUrl.trim(),
            link_url: formState.linkUrl.trim() || undefined,
            status: formState.status,
            display_order: items.length + 1
          });
        } else {
          await createAdminPortalItem(token, {
            section: activeTab,
            title: formState.title.trim() || 'Tanpa judul',
            summary: formState.summary.trim() || '-',
            media_url: formState.mediaUrl.trim() || undefined,
            status: formState.status,
            display_order: items.length + 1
          });
        }
        setSuccessMessage('Konten berhasil ditambahkan ke database.');
      } else {
        if (isCarousel) {
          await updateAdminPortalItem(token, editingId, {
            title: formState.title.trim() || 'Tanpa judul',
            image_url: formState.imageUrl.trim(),
            link_url: formState.linkUrl.trim() || undefined,
            status: formState.status
          });
        } else {
          await updateAdminPortalItem(token, editingId, {
            title: formState.title.trim() || 'Tanpa judul',
            summary: formState.summary.trim() || '-',
            media_url: formState.mediaUrl.trim() || undefined,
            status: formState.status
          });
        }
        setSuccessMessage('Perubahan konten berhasil disimpan ke database.');
      }
      setModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan konten ke server.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, nextStatus: Status) => {
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await updateAdminPortalStatus(token, id, nextStatus);
      setSuccessMessage(`Status konten diubah menjadi ${nextStatus}.`);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah status konten.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!window.confirm('Arsipkan konten ini? Tindakan akan dicatat di audit log.')) return;
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteAdminPortalItem(token, id);
      setSuccessMessage('Konten berhasil diarsipkan.');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengarsipkan konten.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const moveItem = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((item) => item.id === id);
    if (index < 0) return;
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= sorted.length) return;
    const [moved] = sorted.splice(index, 1);
    sorted.splice(nextIndex, 0, moved);
    const reordered = sorted.map((item, idx) => ({ id: item.id, display_order: idx + 1 }));

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await reorderAdminPortalItems(token, reordered);
      setSuccessMessage('Urutan konten berhasil diperbarui.');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengubah urutan konten.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Admin · PostgreSQL Single Source of Truth</p>
          <h1 className="text-2xl font-semibold text-slate-900">CMS Portal Depan</h1>
          <p className="text-sm text-slate-600">Kelola konten publik untuk portal SEHATiCare melalui backend API.</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-slate-500">Memuat data...</span>}
          <Button onClick={openCreate} disabled={loading || saving}>Tambah Baru</Button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700" role="status">
          {successMessage}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Section</CardTitle>
          <CardDescription>Pilih konten yang ingin dikelola.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveTab(section.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  activeTab === section.key
                    ? 'bg-brand text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
          <div className="mt-3 text-sm text-slate-600">{activeSection?.description}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Konten</CardTitle>
          <CardDescription>{activeSection?.label}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden grid-cols-[2fr_1fr_90px_140px_1.6fr] gap-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase text-slate-500 md:grid">
            <span>Judul</span>
            <span>Status</span>
            <span>Urutan</span>
            <span>Updated</span>
            <span>Aksi</span>
          </div>
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-600">
              {loading ? 'Memuat data dari server...' : 'Belum ada konten di section ini.'}
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[2fr_1fr_90px_140px_1.6fr] md:items-center"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  {'imageUrl' in item ? (
                    <div className="text-xs text-slate-500">
                      <p className="truncate">{item.imageUrl}</p>
                      {item.linkUrl ? <p className="truncate">Link: {item.linkUrl}</p> : null}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      <p>{item.summary}</p>
                      {item.mediaUrl ? <p className="truncate">Media: {item.mediaUrl}</p> : null}
                    </div>
                  )}
                </div>
                <div>
                  <Badge className={statusStyles[item.status]}>{item.status}</Badge>
                </div>
                <div className="text-sm text-slate-700">{item.order}</div>
                <div className="text-xs text-slate-500">
                  {new Date(item.updatedAt).toLocaleString('id-ID')}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(item)} disabled={saving}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={saving}
                    onClick={() =>
                      updateStatus(item.id, item.status === 'Published' ? 'Draft' : 'Published')
                    }
                  >
                    {item.status === 'Published' ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(item.id, 'Archived')} disabled={saving}>
                    Archive
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteItem(item.id)} disabled={saving}>
                    Hapus
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveItem(item.id, 'up')}
                    disabled={saving || item.order === 1}
                  >
                    Up
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveItem(item.id, 'down')}
                    disabled={saving || item.order === items.length}
                  >
                    Down
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview Portal Depan</CardTitle>
          <CardDescription>Pratinjau ringkas konten publik dari database.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <PortalCarousel items={carouselPreview} />
          <PortalCardSection
            title="Edukasi awal"
            description="Ringkasan edukasi yang tampil di portal publik."
            items={edukasiPreview}
            limit={3}
            showAction={false}
            enableExpand={false}
            emptyTitle="Belum ada konten"
            emptyDescription="Konten edukasi awal akan ditambahkan."
          />
          <PortalFaqSection
            items={faqPreview}
            limit={3}
            emptyTitle="Belum ada FAQ"
            emptyDescription="Pertanyaan umum akan ditambahkan."
          />
        </CardContent>
      </Card>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setModalOpen(false)}
        >
          <div className="absolute inset-0 bg-slate-900/60" />
          <div className="relative w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
            <Card className="shadow-xl">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>{editingId ? 'Edit Konten' : 'Tambah Konten'}</CardTitle>
                  <CardDescription>{activeSection?.label}</CardDescription>
                </div>
                <button
                  type="button"
                  className="rounded-full px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
                  onClick={() => setModalOpen(false)}
                  aria-label="Tutup"
                >
                  X
                </button>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveItem} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Judul</Label>
                    <Input
                      id="title"
                      value={formState.title}
                      onChange={(event) => setFormState({ ...formState, title: event.target.value })}
                      placeholder="Judul konten"
                      required
                      disabled={saving}
                    />
                  </div>
                  {isCarousel ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="imageUrl">Image URL</Label>
                        <Input
                          id="imageUrl"
                          value={formState.imageUrl}
                          onChange={(event) => setFormState({ ...formState, imageUrl: event.target.value })}
                          placeholder="https://..."
                          required
                          disabled={saving}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={saving}
                          >
                            Upload gambar
                          </Button>
                          <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange('imageUrl')}
                          />
                          <span className="text-xs text-slate-500">Atau tempel URL gambar.</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="linkUrl">Link URL (opsional)</Label>
                        <Input
                          id="linkUrl"
                          value={formState.linkUrl}
                          onChange={(event) => setFormState({ ...formState, linkUrl: event.target.value })}
                          placeholder="/edukasi"
                          disabled={saving}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="summary">Deskripsi singkat</Label>
                        <textarea
                          id="summary"
                          className="min-h-[90px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                          value={formState.summary}
                          onChange={(event) =>
                            setFormState({ ...formState, summary: event.target.value })
                          }
                          placeholder="Ringkasan singkat konten"
                          disabled={saving}
                        />
                      </div>
                      {isMediaUploadTab ? (
                        <div className="space-y-2">
                          <Label htmlFor="mediaUrl">Media URL</Label>
                          <Input
                            id="mediaUrl"
                            value={formState.mediaUrl}
                            onChange={(event) =>
                              setFormState({ ...formState, mediaUrl: event.target.value })
                            }
                            placeholder="https://..."
                            disabled={saving}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => mediaInputRef.current?.click()}
                              disabled={saving}
                            >
                              {mediaUploadLabel}
                            </Button>
                            <input
                              ref={mediaInputRef}
                              type="file"
                              accept={mediaAccept}
                              className="hidden"
                              onChange={handleFileChange('mediaUrl')}
                            />
                            <span className="text-xs text-slate-500">
                              Menyimpan file sebagai data URL di browser.
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      value={formState.status}
                      disabled={saving}
                      onChange={(event) =>
                        setFormState({ ...formState, status: event.target.value as Status })
                      }
                    >
                      <option value="Draft">Draft</option>
                      <option value="Published">Published</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
