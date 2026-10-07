import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, buttonClassName } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { getPublishedItems } from '../../components/portal/PortalContentSections';
import {
  cleanupLegacyPortalStorage,
  fetchPublicPortalContent,
  seedContent,
  type PortalContent
} from '../../store/portalContentStore';

type EducationCard = {
  id: string;
  title: string;
  summary: string;
  typeLabel: string;
};

const summarize = (summary: string) =>
  summary && summary.trim() && summary.trim() !== '-'
    ? summary
    : 'Materi edukasi ringkas untuk membantu memahami langkah awal.';

export function PublicEducationPage() {
  const [portalContent, setPortalContent] = useState<PortalContent>(() => seedContent);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const clampStyle: CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  };

  useEffect(() => {
    cleanupLegacyPortalStorage();
    void fetchPublicPortalContent().then((data) => {
      if (data) setPortalContent(data);
    });
  }, []);

  const educationItems = useMemo<EducationCard[]>(() => {
    const edukasi = getPublishedItems(portalContent.edukasiAwal).map((item) => ({
      id: item.id,
      title: item.title,
      summary: summarize(item.summary),
      typeLabel: 'Artikel'
    }));
    const infografis = getPublishedItems(portalContent.infografis).map((item) => ({
      id: item.id,
      title: item.title,
      summary: summarize(item.summary),
      typeLabel: 'Infografik'
    }));
    const video = getPublishedItems(portalContent.video).map((item) => ({
      id: item.id,
      title: item.title,
      summary: summarize(item.summary),
      typeLabel: 'Video'
    }));
    return [...edukasi, ...infografis, ...video];
  }, [portalContent]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Portal Publik</p>
            <h1 className="text-2xl font-semibold text-slate-900">Edukasi HIV/AIDS</h1>
            <p className="text-sm text-slate-600">
              Daftar materi edukasi awal dan konten multimedia.
            </p>
          </div>
          <Link to="/" className={buttonClassName({ variant: 'outline' })}>
            Kembali ke Portal
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {educationItems.length === 0 ? (
            <Card className="border-slate-200 bg-white">
              <CardHeader>
                <CardTitle className="text-base">Belum ada materi</CardTitle>
                <CardDescription>Konten edukasi akan muncul setelah dipublish admin.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            educationItems.map((item) => {
              const isExpanded = expandedIds.includes(item.id);
              const shouldClamp = item.summary.length > 140;
              return (
                <Card key={item.id} className="border-slate-200 bg-white">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {item.typeLabel}
                      </span>
                    </div>
                    <CardDescription style={!isExpanded && shouldClamp ? clampStyle : undefined}>
                      {item.summary}
                    </CardDescription>
                    {shouldClamp ? (
                      <button
                        type="button"
                        className="mt-2 text-xs font-semibold text-brand hover:underline"
                        onClick={() => toggleExpanded(item.id)}
                      >
                        {isExpanded ? 'Tutup' : 'Lihat'}
                      </button>
                    ) : null}
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" variant="secondary">
                      Lihat detail
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
