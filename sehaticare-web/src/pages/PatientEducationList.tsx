import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useApiClient } from '../hooks/useApiClient';
import { EducationListItem, EducationListResponse } from '../types/education';

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function PatientEducationList() {
  const fetcher = useApiClient();
  const [data, setData] = useState<EducationListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetcher<EducationListResponse>('/education?page=1&limit=10');
        if (!active) return;
        setData(response);
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
  }, [fetcher]);

  const items: EducationListItem[] = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Edukasi pasien</p>
          <h1 className="text-2xl font-semibold text-slate-900">Artikel kesehatan terbaru</h1>
        </div>
        <Badge variant="info">PASIEN</Badge>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex items-center gap-3">
            <span className="h-2 w-2 animate-ping rounded-full bg-brand" />
            <span className="text-sm text-slate-600">Memuat daftar edukasi...</span>
          </CardContent>
        </Card>
      )}

      {error && !loading && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800">Gagal memuat</CardTitle>
            <CardDescription className="text-amber-700">{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {!loading && !error && items.length === 0 && (
        <Card>
          <CardContent>
            <p className="text-sm text-slate-600">Belum ada artikel edukasi.</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <Link key={item.id} to={`/patient/education/${item.id}`} className="block h-full">
              <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>Diterbitkan {formatDate(item.created_at)}</CardDescription>
                  </div>
                  {item.category ? <Badge variant="outline">{item.category}</Badge> : null}
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-slate-700">
                    {item.summary || 'Tidak ada ringkasan.'}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
