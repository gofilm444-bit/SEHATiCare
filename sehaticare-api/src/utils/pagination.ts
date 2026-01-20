export function buildPagination(query: { page?: number | string; pageSize?: number | string }) {
  const page = Math.max(Number(query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 10, 1), 50);
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
    page,
    pageSize
  };
}
