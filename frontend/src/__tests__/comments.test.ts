import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useInvaderComments } from '../features/comments/hooks/use-invader-comments';
import type { Comment } from '../features/comments/types';

jest.mock('../features/comments/services/comments.api', () => ({
  fetchComments: jest.fn(),
  postComment: jest.fn(),
  reportComment: jest.fn(),
  deleteComment: jest.fn(),
  reactToComment: jest.fn(),
}));

import {
  fetchComments,
  postComment,
  reportComment,
  deleteComment,
  reactToComment,
} from '../features/comments/services/comments.api';
import { hasNewComments } from '../features/comments/seen-store';

const mockFetch = fetchComments as jest.Mock;
const mockPost = postComment as jest.Mock;
const mockReport = reportComment as jest.Mock;
const mockDelete = deleteComment as jest.Mock;
const mockReact = reactToComment as jest.Mock;

function comment(over: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    invader_id: 10,
    user_id: 100,
    username: 'alice',
    body: 'hello',
    status: 'visible',
    created_at: '2026-07-16T12:00:00',
    likes: 0,
    dislikes: 0,
    my_reaction: 0,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useInvaderComments', () => {
  it('does not fetch while disabled', () => {
    renderHook(() => useInvaderComments(10, false));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('loads the wall when enabled', async () => {
    mockFetch.mockResolvedValue([comment({ id: 1 }), comment({ id: 2 })]);
    const { result } = renderHook(() => useInvaderComments(10, true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).toHaveBeenCalledWith(10);
    expect(result.current.comments).toHaveLength(2);
    expect(result.current.error).toBe(false);
  });

  it('flags an error when the fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useInvaderComments(10, true));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.comments).toHaveLength(0);
  });

  it('prepends a freshly posted visible comment', async () => {
    mockFetch.mockResolvedValue([comment({ id: 1, body: 'old' })]);
    mockPost.mockResolvedValue(comment({ id: 2, body: 'new', status: 'visible' }));
    const { result } = renderHook(() => useInvaderComments(10, true));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));

    await act(async () => { await result.current.add('new'); });

    expect(mockPost).toHaveBeenCalledWith(10, 'new');
    expect(result.current.comments.map((c) => c.body)).toEqual(['new', 'old']);
  });

  it('does not insert a hidden comment (never listed) but returns it', async () => {
    mockFetch.mockResolvedValue([]);
    mockPost.mockResolvedValue(comment({ id: 3, status: 'hidden' }));
    const { result } = renderHook(() => useInvaderComments(10, true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let returned: Comment | null = null;
    await act(async () => { returned = await result.current.add('nasty'); });

    expect(returned).not.toBeNull();
    expect(returned!.status).toBe('hidden');
    expect(result.current.comments).toHaveLength(0);
  });

  it('removes a deleted comment from the list', async () => {
    mockFetch.mockResolvedValue([comment({ id: 1 }), comment({ id: 2 })]);
    mockDelete.mockResolvedValue(undefined);
    const { result } = renderHook(() => useInvaderComments(10, true));
    await waitFor(() => expect(result.current.comments).toHaveLength(2));

    await act(async () => { await result.current.remove(1); });

    expect(mockDelete).toHaveBeenCalledWith(1);
    expect(result.current.comments.map((c) => c.id)).toEqual([2]);
  });

  it('replaces a reported comment with the updated one', async () => {
    mockFetch.mockResolvedValue([comment({ id: 1, status: 'visible' })]);
    mockReport.mockResolvedValue(comment({ id: 1, status: 'pending_review' }));
    const { result } = renderHook(() => useInvaderComments(10, true));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));

    await act(async () => { await result.current.report(1); });

    expect(result.current.comments[0].status).toBe('pending_review');
  });

  it('replaces a comment with its updated reaction state', async () => {
    mockFetch.mockResolvedValue([comment({ id: 1, likes: 0, my_reaction: 0 })]);
    mockReact.mockResolvedValue(comment({ id: 1, likes: 1, my_reaction: 1 }));
    const { result } = renderHook(() => useInvaderComments(10, true));
    await waitFor(() => expect(result.current.comments).toHaveLength(1));

    await act(async () => { await result.current.react(1, 1); });

    expect(mockReact).toHaveBeenCalledWith(1, 1);
    expect(result.current.comments[0].likes).toBe(1);
    expect(result.current.comments[0].my_reaction).toBe(1);
  });

  it('drops stale data when disabled again', async () => {
    mockFetch.mockResolvedValue([comment({ id: 1 })]);
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useInvaderComments(10, enabled),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current.comments).toHaveLength(1));

    rerender({ enabled: false });
    expect(result.current.comments).toHaveLength(0);
  });
});

describe('hasNewComments', () => {
  it('is true when the count exceeds what was last seen', () => {
    expect(hasNewComments({ 10: 2 }, 10, 5)).toBe(true);
  });

  it('is false once the count has been seen', () => {
    expect(hasNewComments({ 10: 5 }, 10, 5)).toBe(false);
  });

  it('treats a never-seen invader with comments as new', () => {
    expect(hasNewComments({}, 10, 3)).toBe(true);
  });

  it('is false when there are no comments', () => {
    expect(hasNewComments({}, 10, 0)).toBe(false);
  });
});
