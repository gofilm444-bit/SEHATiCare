import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useApiClient } from '../hooks/useApiClient';
import { EducationDetail } from '../types/education';

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function PatientEducationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fetcher = useApiClient();
  const [article, setArticle] = useState<EducationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!id) {
        setError('Artikel tidak ditemukan.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const response = await fetcher<EducationDetail>(`/education/${id}`);
        if (!active) return;
        setArticle(response);
      } catch (err) {
        if (!active) return;
        setError((err as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [fetcher, id]);

  const paragraphs = useMemo(() => {
    if (!article?.body_markdown) return [];
    return article.body_markdown
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [article]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Edukasi pasien</p>
          <h1 className="text-2xl font-semibold text-slate-900">{article?.title ?? 'Detail artikel'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/patient/education')}>
            Kembali
          </Button>
          <Badge variant="outline">{article?.category ?? 'Umum'}</Badge>
        </div>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex items-center gap-3">
            <span className="h-2 w-2 animate-ping rounded-full bg-brand" />
            <span className="text-sm text-slate-600">Memuat artikel...</span>
          </CardContent>
        </Card>
      )}

      {error && !loading && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800">Gagal memuat</CardTitle>
            <CardDescription className="text-amber-700">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" onClick={() => navigate('/patient/education')}>
              Kembali ke daftar
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && article && (
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <Badge variant="outline">{article.category ?? 'Umum'}</Badge>
              <span>Diterbitkan {formatDate(article.created_at)}</span>
            </div>
            <CardTitle className="text-2xl">{article.title}</CardTitle>
            {article.summary ? <CardDescription className="text-slate-700">{article.summary}</CardDescription> : null}
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-slate-800">
            {paragraphs.length > 0 ? (
              paragraphs.map((para, idx) => <p key={idx}>{para}</p>)
            ) : (
              <p>Konten artikel belum tersedia.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
