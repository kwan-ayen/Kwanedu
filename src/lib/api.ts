import { upload } from '@vercel/blob/client';
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

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const USE_VERCEL_BLOB_UPLOADS = import.meta.env.VITE_BLOB_CLIENT_UPLOADS === 'true';
const RESOURCE_UPLOAD_MIME_TYPES: Record<string, string> = {
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  odt: 'application/vnd.oasis.opendocument.text',
  odp: 'application/vnd.oasis.opendocument.presentation',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  pdf: 'application/pdf',
  png: 'image/png',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rtf: 'application/rtf',
  txt: 'text/plain',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const CMS_UPLOAD_MIME_TYPES: Record<string, string> = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read the selected file.'));
    reader.readAsDataURL(file);
  });
}

async function uploadToVercelBlob(file: File, purpose: 'cms' | 'resource'): Promise<string> {
  const token = sessionStorage.getItem('kwan_session_token');
  if (!token) throw new Error('Sign in as an administrator before uploading files.');

  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!extension) throw new Error('The selected file needs a supported extension.');
  const contentType =
    (purpose === 'resource' ? RESOURCE_UPLOAD_MIME_TYPES : CMS_UPLOAD_MIME_TYPES)[extension];
  if (!contentType) throw new Error('The selected file type is not supported.');
  const id = crypto.randomUUID().replace(/-/g, '');
  const pathname =
    purpose === 'resource'
      ? `resource-files/${id}`
      : `cms-banners/${Date.now()}-${id}.${extension}`;
  const blob = await upload(pathname, file, {
    access: purpose === 'resource' ? 'private' : 'public',
    contentType,
    handleUploadUrl: apiUrl('/api/blob-upload'),
    headers: { Authorization: `Bearer ${token}` },
    clientPayload: purpose,
    multipart: file.size > 5 * 1024 * 1024,
  });
  return blob.pathname;
}

type ResourceWritePayload = Partial<ResourceItem> & {
  attachmentDataUrl?: string;
  attachmentFileName?: string;
  attachmentFile?: File;
  removeAttachment?: boolean;
};

async function prepareResourcePayload(payload: ResourceWritePayload) {
  const { attachmentFile, ...rest } = payload;
  if (!attachmentFile) return rest;
  if (USE_VERCEL_BLOB_UPLOADS) {
    return {
      ...rest,
      attachmentFileName: attachmentFile.name,
      attachmentBlobPath: await uploadToVercelBlob(attachmentFile, 'resource'),
    };
  }
  return {
    ...rest,
    attachmentFileName: attachmentFile.name,
    attachmentDataUrl: await readFileAsDataUrl(attachmentFile),
  };
}

export function formatUGX(amount: number): string {
  if (!amount || amount <= 0) return 'Free';
  return `UGX ${amount.toLocaleString('en-UG')}`;
}

async function readJson<T>(response: Response, endpoint: string): Promise<T> {
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  if (!contentType.includes('json')) {
    throw new Error(
      `The API at ${endpoint} returned a non-JSON response (HTTP ${response.status}). ` +
        'Deploy the Node.js app with "npm start"; static hosting alone does not serve the API.'
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`The API at ${endpoint} returned invalid JSON (HTTP ${response.status}).`);
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem('kwan_session_token');
  const res = await fetch(apiUrl(url), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  const data = await readJson<{ error?: string } & T>(res, url);
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data as T;
}

async function fetchResourceFile(resourceId: string): Promise<{ blob: Blob; fileName: string }> {
  const token = sessionStorage.getItem('kwan_session_token');
  const endpoint = `/api/resources/${encodeURIComponent(resourceId)}/file`;
  const response = await fetch(apiUrl(endpoint), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const data = await readJson<{ error?: string }>(response, endpoint);
    throw new Error(data.error || 'Unable to retrieve this resource file.');
  }
  const encodedName = response.headers.get('X-Resource-Filename');
  let fileName = 'resource-download';
  if (encodedName) {
    try {
      fileName = decodeURIComponent(encodedName);
    } catch {
      fileName = 'resource-download';
    }
  }
  return { blob: await response.blob(), fileName };
}

export const api = {
  fetchState: () => request<PlatformState>('/api/state'),
  getAdminSetupStatus: () =>
    request<{ required: boolean; setupKeyConfigured: boolean }>('/api/auth/setup-status'),
  setupAdmin: (setupKey: string, password: string) =>
    request<{ user: UserAccount; sessionToken: string }>('/api/auth/setup-admin', {
      method: 'POST',
      body: JSON.stringify({ setupKey, password }),
    }),
  currentUser: () => request<{ user: UserAccount }>('/api/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: UserAccount; sessionToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: Partial<UserAccount>) =>
    request<{ user: UserAccount; state: PlatformState; sessionToken: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createTutor: (payload: { name: string; email: string; password: string }) =>
    request<{ user: UserAccount; state: PlatformState }>('/api/admin/tutors', {
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
  createResource: async (payload: ResourceWritePayload) =>
    request<{ state: PlatformState }>('/api/resources', {
      method: 'POST',
      body: JSON.stringify(await prepareResourcePayload(payload)),
    }),
  updateResource: async (id: string, payload: ResourceWritePayload) =>
    request<{ state: PlatformState }>(`/api/resources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(await prepareResourcePayload(payload)),
    }),
  fetchResourceFile,
  deleteResource: (id: string) =>
    request<{ state: PlatformState }>(`/api/resources/${id}`, {
      method: 'DELETE',
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
  uploadCmsBanner: async (payload: { filename: string; file: File; label?: string; uploadedBy?: string }) => {
    const body = USE_VERCEL_BLOB_UPLOADS
      ? {
          filename: payload.filename,
          blobPathname: await uploadToVercelBlob(payload.file, 'cms'),
          label: payload.label,
          uploadedBy: payload.uploadedBy,
        }
      : {
          filename: payload.filename,
          dataUrl: await readFileAsDataUrl(payload.file),
          label: payload.label,
          uploadedBy: payload.uploadedBy,
        };
    return request<{ asset: CmsMediaAsset; state: PlatformState }>('/api/cms/upload', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
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
