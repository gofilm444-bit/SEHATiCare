import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import type { CarouselImage, PortalContent, PortalItem, Status } from '../../store/portalContentStore';

type StatusItem = { status: Status; order: number };

export const getPublishedItems = <T extends StatusItem>(items: T[]) =>
  [...items].filter((item) => item.status === 'Published').sort((a, b) => a.order - b.order);

const sortByUpdatedDesc = <T extends { updatedAt: string }>(items: T[]) =>
  [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

export const buildAutoCarouselItems = (content: PortalContent, limit = 6): CarouselImage[] => {
  const source = [
    ...content.edukasiAwal,
    ...content.video,
    ...content.infografis
  ].filter((item) => item.status === 'Published');
  return sortByUpdatedDesc(source)
    .slice(0, limit)
    .map((item, index) => ({
      id: `auto-${item.id}`,
      title: item.title,
      imageUrl: item.mediaUrl || '/brand/logo-sehaticare.png',
      linkUrl: `/#portal-item-${item.id}`,
      status: 'Published',
      order: index + 1,
      updatedAt: item.updatedAt
    }));
};

type PortalCarouselProps = {
  items: CarouselImage[];
  title?: string;
  description?: string;
};

export function PortalCarousel({
  items,
  title = 'Carousel gambar',
  description = 'Sorotan visual untuk informasi penting.'
}: PortalCarouselProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || items.length === 0) return;
    const interval = window.setInterval(() => {
      setActiveIndex((prev) => {
        const nextIndex = (prev + 1) % items.length;
        const step = getScrollStep(container);
        if (step > 0) {
          container.scrollTo({ left: step * nextIndex, behavior: 'smooth' });
        }
        return nextIndex;
      });
    }, 4500);
    return () => window.clearInterval(interval);
  }, [items]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        const step = getScrollStep(container);
        if (step > 0) {
          const nextIndex = Math.min(items.length - 1, Math.round(container.scrollLeft / step));
          setActiveIndex(nextIndex);
        }
        raf = 0;
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [items.length]);

  if (items.length === 0) return null;

  const goToIndex = (index: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const step = getScrollStep(container);
    if (step <= 0) return;
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    container.scrollTo({ left: step * clamped, behavior: 'smooth' });
    setActiveIndex(clamped);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            onClick={() => goToIndex(activeIndex - 1)}
            aria-label="Sebelumnya"
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            onClick={() => goToIndex(activeIndex + 1)}
            aria-label="Berikutnya"
          >
            Next
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex snap-x snap-mandatory gap-4 overflow-hidden pb-2">
        {items.map((item) => {
          const card = (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-40 w-[260px] overflow-hidden sm:w-[340px]">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="space-y-1 p-3">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                {item.linkUrl ? <p className="text-xs text-slate-500">Klik untuk detail</p> : null}
              </div>
            </div>
          );

          if (item.linkUrl) {
            return (
              <a
                key={item.id}
                href={item.linkUrl}
                className="snap-start"
                target="_blank"
                rel="noreferrer"
                data-carousel-item
              >
                {card}
              </a>
            );
          }

          return (
            <div key={item.id} className="snap-start" data-carousel-item>
              {card}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-2">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-label={`Slide ${index + 1}`}
            onClick={() => goToIndex(index)}
            className={`h-2 w-2 rounded-full transition ${
              index === activeIndex ? 'bg-brand' : 'bg-slate-300'
            }`}
          />
        ))}
      </div>
    </section>
  );
}

const getScrollStep = (container: HTMLDivElement) => {
  const nodes = container.querySelectorAll<HTMLElement>('[data-carousel-item]');
  if (nodes.length === 0) return 0;
  if (nodes.length > 1) {
    return nodes[1].offsetLeft - nodes[0].offsetLeft;
  }
  return nodes[0].offsetWidth;
};

type PortalCardSectionProps = {
  title: string;
  description: string;
  items: PortalItem[];
  limit?: number;
  actionHref?: string;
  actionLabel?: string;
  actionMode?: 'link' | 'toggle';
  showAction?: boolean;
  enableExpand?: boolean;
  idPrefix?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function PortalCardSection({
  title,
  description,
  items,
  limit,
  actionHref = '/edukasi',
  actionLabel = 'Lihat',
  actionMode = 'link',
  showAction = true,
  enableExpand = true,
  idPrefix = 'portal-item',
  emptyTitle = 'Belum ada konten',
  emptyDescription = 'Konten akan ditambahkan.'
}: PortalCardSectionProps) {
  const visibleItems = limit ? items.slice(0, limit) : items;
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const clampStyle: CSSProperties = {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {visibleItems.length === 0 ? (
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-base">{emptyTitle}</CardTitle>
              <CardDescription>{emptyDescription}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          visibleItems.map((item) => {
            const isExpanded = expandedIds.includes(item.id);
            const shouldClamp = enableExpand && item.summary.length > 140;
            const showInlineToggle = enableExpand && actionMode !== 'toggle' && shouldClamp;
            return (
              <Card
                key={item.id}
                id={`${idPrefix}-${item.id}`}
                className="border-slate-200 bg-white"
              >
                <CardHeader>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription style={!isExpanded && shouldClamp ? clampStyle : undefined}>
                    {item.summary}
                  </CardDescription>
                  {showInlineToggle ? (
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-brand hover:underline"
                      onClick={() => toggleExpanded(item.id)}
                    >
                      {isExpanded ? 'Tutup' : 'Lihat'}
                    </button>
                  ) : null}
                </CardHeader>
              {showAction ? (
                <CardContent>
                  {actionMode === 'link' ? (
                    <Link to={actionHref} className="text-sm font-medium text-brand hover:underline">
                      {actionLabel}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-semibold text-brand hover:underline"
                      onClick={() => toggleExpanded(item.id)}
                    >
                      {isExpanded ? 'Tutup' : actionLabel}
                    </button>
                  )}
                </CardContent>
              ) : null}
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}

type PortalFaqSectionProps = {
  items: PortalItem[];
  limit?: number;
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function PortalFaqSection({
  items,
  limit,
  title = 'FAQ',
  description = 'Jawaban singkat atas pertanyaan umum.',
  emptyTitle = 'Belum ada FAQ',
  emptyDescription = 'Pertanyaan umum akan ditambahkan.'
}: PortalFaqSectionProps) {
  const visibleItems = limit ? items.slice(0, limit) : items;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      <div className="grid gap-3">
        {visibleItems.length === 0 ? (
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <CardTitle className="text-base">{emptyTitle}</CardTitle>
              <CardDescription>{emptyDescription}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          visibleItems.map((item) => (
            <Card key={item.id} className="border-slate-200 bg-white">
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
                <CardDescription>{item.summary}</CardDescription>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
