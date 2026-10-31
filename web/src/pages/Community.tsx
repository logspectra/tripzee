import { useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { api, qs } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import type { City, Page, Review } from '../lib/types';
import { ReviewItem } from '../components/ReviewSection';
import { Button, Card, EmptyState, ErrorState, PageHeader, Select, Spinner } from '../components/ui';

export default function Community() {
  const [sort, setSort] = useState('recent');
  const [minRating, setMinRating] = useState('');
  const [tips, setTips] = useState(false);
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);
  const cities = useAsync((signal) => api<City[]>('/destinations/cities', { signal }), []);
  const list = useAsync((signal) => api<Page<Review>>(`/reviews${qs({ sort, minRating, tips: tips || undefined, city, page })}`, { signal }), [sort, minRating, tips, city, page]);
  const reset = (fn: () => void) => { fn(); setPage(1); };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader title="Community reviews & tips" subtitle="Honest experiences from Tripzee travellers. One review per traveller per place." />
      <Card className="mb-6 flex flex-wrap items-center gap-2 p-3">
        <Select aria-label="Sort" className="w-auto" value={sort} onChange={(e) => reset(() => setSort(e.target.value))}>
          <option value="recent">Most recent</option>
          <option value="highest">Highest rated</option>
          <option value="lowest">Lowest rated</option>
        </Select>
        <Select aria-label="Minimum rating" className="w-auto" value={minRating} onChange={(e) => reset(() => setMinRating(e.target.value))}>
          <option value="">Any rating</option>
          {[5, 4, 3, 2].map((r) => <option key={r} value={r}>{r}★ & up</option>)}
        </Select>
        <Select aria-label="City" className="w-auto" value={city} onChange={(e) => reset(() => setCity(e.target.value))}>
          <option value="">All cities</option>
          {cities.data?.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </Select>
        <label className="flex items-center gap-2 px-2 text-sm"><input type="checkbox" checked={tips} onChange={(e) => reset(() => setTips(e.target.checked))} /> Tips only</label>
      </Card>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : list.loading && !list.data ? <Spinner /> : list.data?.items.length === 0 ? (
        <EmptyState icon={<MessageSquareText className="h-8 w-8" />} title="No reviews yet">Visited somewhere? Open its page and share your experience.</EmptyState>
      ) : (
        <Card className="px-5">
          {list.data?.items.map((r) => <ReviewItem key={r.id} r={r} showDestination />)}
        </Card>
      )}
      {list.data && list.data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm text-muted">Page {page} of {list.data.totalPages}</span>
          <Button size="sm" variant="secondary" disabled={page >= list.data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
