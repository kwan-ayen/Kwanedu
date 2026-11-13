import type {
  BlogPost,
  ClassLevel,
  CmsMediaAsset,
  DivisionId,
  ForumThread,
  PlatformSettings,
  PlatformState,
  ResourceItem,
  Submission,
  Transaction,
  UserAccount,
  WebsiteConfig,
} from '../types/kwan';

export const DIVISION_META: Record<
  DivisionId,
  { label: string; short: string; classes: ClassLevel[]; badgeText: string }
> = {
  primary: {
    label: 'Primary Education',
    short: 'Primary',
    classes: ['P.4', 'P.5', 'P.6', 'P.7'],
    badgeText: 'P.4 – P.7',
  },
  lower_secondary: {
    label: 'Lower Secondary',
    short: 'Lower Secondary',
    classes: ['S.1', 'S.2', 'S.3', 'S.4'],
    badgeText: 'S.1 – S.4',
  },
  upper_secondary: {
    label: 'Upper Secondary',
    short: 'Upper Secondary',
    classes: ['S.5', 'S.6'],
    badgeText: 'S.5 – S.6',
  },
};

export const UPPER_SECONDARY_COMBINATIONS: Record<
  'Sciences' | 'Arts',
  { code: string; label: string; subjects: string[] }[]
> = {
  Sciences: [
    {
      code: 'PCM/ICT',
      label: 'PCM/ICT — Physics, Chemistry, Mathematics + Sub-ICT',
      subjects: ['Principal Physics', 'Principal Chemistry', 'Principal Mathematics', 'Subsidiary ICT'],
    },
    {
      code: 'PCB/Sub-Math',
      label: 'PCB/Sub-Math — Physics, Chemistry, Biology + Sub-Math',
      subjects: ['Principal Physics', 'Principal Chemistry', 'Principal Biology', 'Subsidiary Mathematics'],
    },
    {
      code: 'BCM/Sub-ICT',
      label: 'BCM/Sub-ICT — Biology, Chemistry, Mathematics + Sub-ICT',
      subjects: ['Principal Biology', 'Principal Chemistry', 'Principal Mathematics', 'Subsidiary ICT'],
    },
    {
      code: 'PEM/ICT',
      label: 'PEM/ICT — Physics, Economics, Mathematics + Sub-ICT',
      subjects: ['Principal Physics', 'Principal Economics', 'Principal Mathematics', 'Subsidiary ICT'],
    },
    {
      code: 'MEG/Sub-ICT',
      label: 'MEG/Sub-ICT — Mathematics, Economics, Geography + Sub-ICT',
      subjects: ['Principal Mathematics', 'Principal Economics', 'Principal Geography', 'Subsidiary ICT'],
    },
    {
      code: 'BAG/Sub-Math',
      label: 'BAG/Sub-Math — Biology, Agriculture, Geography + Sub-Math',
      subjects: ['Principal Biology', 'Principal Agriculture', 'Principal Geography', 'Subsidiary Mathematics'],
    },
  ],
  Arts: [
    {
      code: 'HEG/Sub-ICT',
      label: 'HEG/Sub-ICT — History, Economics, Geography + Sub-ICT',
      subjects: ['Principal History', 'Principal Economics', 'Principal Geography', 'Subsidiary ICT'],
    },
    {
      code: 'DEG/Sub-ICT',
      label: 'DEG/Sub-ICT — Divinity, Economics, Geography + Sub-ICT',
      subjects: ['Principal Divinity', 'Principal Economics', 'Principal Geography', 'Subsidiary ICT'],
    },
    {
      code: 'HEL/Sub-ICT',
      label: 'HEL/Sub-ICT — History, Economics, Literature + Sub-ICT',
      subjects: ['Principal History', 'Principal Economics', 'Principal Literature in English', 'Subsidiary ICT'],
    },
    {
      code: 'HED/Sub-ICT',
      label: 'HED/Sub-ICT — History, Economics, Divinity + Sub-ICT',
      subjects: ['Principal History', 'Principal Economics', 'Principal Divinity', 'Subsidiary ICT'],
    },
    {
      code: 'LAG/Sub-ICT',
      label: 'LAG/Sub-ICT — Literature, Art & Design, Geography + Sub-ICT',
      subjects: ['Principal Literature', 'Principal Art & Design', 'Principal Geography', 'Subsidiary ICT'],
    },
    {
      code: 'GEA/Sub-Math',
      label: 'GEA/Sub-Math — Geography, Economics, Entrepreneurship + Sub-Math',
      subjects: ['Principal Geography', 'Principal Economics', 'Principal Entrepreneurship', 'Subsidiary Mathematics'],
    },
  ],
};

export const SUBJECT_COMBINATIONS = [
  ...UPPER_SECONDARY_COMBINATIONS.Sciences.map((c) => c.label),
  ...UPPER_SECONDARY_COMBINATIONS.Arts.map((c) => c.label),
];

export function formatUGX(amount: number): string {
  if (!amount || amount <= 0) return 'Free';
  return `UGX ${amount.toLocaleString('en-UG')}`;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data as T;
}

export const api = {
  fetchState: () => request<PlatformState>('/api/state'),
  login: (email: string, password: string) =>
    request<{ user: UserAccount }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: Partial<UserAccount>) =>
    request<{ user: UserAccount; state: PlatformState }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createCourse: (payload: Record<string, unknown>) =>
    request<{ state: PlatformState }>('/api/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCourse: (id: string, payload: Record<string, unknown>) =>
    request<{ state: PlatformState }>(`/api/courses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  purchaseItem: (payload: {
    userId: string;
    itemType: 'course' | 'resource';
    itemId: string;
    method?: Transaction['method'];
  }) =>
    request<{ user: UserAccount; state: PlatformState }>('/api/purchase', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  completeLesson: (userId: string, lessonId: string) =>
    request<{ user: UserAccount; state: PlatformState }>('/api/lessons/complete', {
      method: 'POST',
      body: JSON.stringify({ userId, lessonId }),
    }),
  submitWork: (payload: Partial<Submission>) =>
    request<{ submission: Submission; state: PlatformState }>('/api/submissions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  markSubmission: (id: string, payload: Partial<Submission>) =>
    request<{ submission: Submission; state: PlatformState }>(
      `/api/submissions/${id}/mark`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    ),
  createForumThread: (payload: {
    courseId: string;
    topicId: string;
    topicTitle: string;
    authorId: string;
    title: string;
    body: string;
  }) =>
    request<{ thread: ForumThread; state: PlatformState }>('/api/forum/threads', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  replyForumThread: (threadId: string, payload: { authorId: string; body: string }) =>
    request<{ thread: ForumThread; state: PlatformState }>(`/api/forum/threads/${threadId}/replies`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateForumThreadStatus: (threadId: string, status: ForumThread['status']) =>
    request<{ thread: ForumThread; state: PlatformState }>(`/api/forum/threads/${threadId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  createBlogPost: (payload: Partial<BlogPost>) =>
    request<{ state: PlatformState }>('/api/blog', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateBlogPost: (id: string, payload: Partial<BlogPost>) =>
    request<{ state: PlatformState }>(`/api/blog/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteBlogPost: (id: string) =>
    request<{ state: PlatformState }>(`/api/blog/${id}`, {
      method: 'DELETE',
    }),
  addBlogComment: (id: string, authorName: string, text: string) =>
    request<{ state: PlatformState }>(`/api/blog/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ authorName, text }),
    }),
  createResource: (payload: Partial<ResourceItem>) =>
    request<{ state: PlatformState }>('/api/resources', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateResource: (id: string, payload: Partial<ResourceItem>) =>
    request<{ state: PlatformState }>(`/api/resources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  updateUser: (id: string, payload: Partial<UserAccount>) =>
    request<{ state: PlatformState }>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  refundPayment: (id: string) =>
    request<{ state: PlatformState }>(`/api/payments/${id}/refund`, {
      method: 'POST',
    }),
  saveCmsDraft: (config: WebsiteConfig) =>
    request<{ state: PlatformState }>('/api/cms/draft', {
      method: 'POST',
      body: JSON.stringify(config),
    }),
  publishCms: (config: WebsiteConfig, label?: string, savedBy?: string) =>
    request<{ state: PlatformState }>('/api/cms/publish', {
      method: 'POST',
      body: JSON.stringify({ config, label, savedBy }),
    }),
  restoreCmsVersion: (versionId: string) =>
    request<{ state: PlatformState }>(`/api/cms/restore/${versionId}`, {
      method: 'POST',
    }),
  uploadCmsBanner: (payload: { filename: string; dataUrl: string; label?: string; uploadedBy?: string }) =>
    request<{ asset: CmsMediaAsset; state: PlatformState }>('/api/cms/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteCmsMedia: (id: string) =>
    request<{ state: PlatformState }>(`/api/cms/media/${id}`, {
      method: 'DELETE',
    }),
  updateSettings: (payload: Partial<PlatformSettings>) =>
    request<{ state: PlatformState }>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};
