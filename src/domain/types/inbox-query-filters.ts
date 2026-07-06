/** Optional filters for GET /api/v1/inbox (C6 C7 C12). */
export interface InboxQueryFilters {
  unreadOnly?: boolean;
  unansweredOnly?: boolean;
  /** Free-text search against phoneNumber and funnel_users.name */
  searchQuery?: string;
  /** Normalized phone variants resolved from funnel name search */
  searchPhoneNumbers?: string[];
}

export type InboxListFilter = 'unread' | 'unanswered';

export function buildInboxQueryFilters(input: {
  listFilter?: InboxListFilter;
  q?: string;
  searchPhoneNumbers?: string[];
}): InboxQueryFilters | undefined {
  const hasListFilter = input.listFilter !== undefined;
  const hasSearch = Boolean(input.q?.trim()) || Boolean(input.searchPhoneNumbers?.length);

  if (!hasListFilter && !hasSearch) {
    return undefined;
  }

  return {
    ...(input.listFilter === 'unread' && { unreadOnly: true }),
    ...(input.listFilter === 'unanswered' && { unansweredOnly: true }),
    ...(input.q?.trim() && { searchQuery: input.q.trim() }),
    ...(input.searchPhoneNumbers?.length && { searchPhoneNumbers: input.searchPhoneNumbers }),
  };
}
