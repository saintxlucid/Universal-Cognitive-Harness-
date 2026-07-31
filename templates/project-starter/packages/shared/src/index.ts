export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, string[]>;
};

export function paginate<T>(data: T[], total: number, page: number, pageSize: number): PaginatedResponse<T> {
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function createError(code: string, message: string, details?: Record<string, string[]>): ApiError {
  return { code, message, details };
}
