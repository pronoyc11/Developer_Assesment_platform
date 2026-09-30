export type PaginationQuery = {
  page?: string | number;
  limit?: string | number;
};

export type PaginationResult = {
  page: number;
  limit: number;
  skip: number;
};

export const getPagination = (query: PaginationQuery): PaginationResult => {
  const page = Math.max(Number(query.page) || 1, 1);

  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);

  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
};

export const getPaginationMeta = (
  page: number,
  limit: number,
  total: number,
) => {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};
