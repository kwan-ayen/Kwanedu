import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { del, get, head } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { Readable } from 'node:stream';
import { databaseMiddleware, getDb, persistDbRequest, saveDb } from './server/db.ts';
import { hashPassword, verifyPassword } from './server/auth.ts';
import type {
  BlogPost,
  CmsMediaAsset,
  Course,
  DivisionId,
  ForumReply,
  ForumThread,
  ResourceItem,
  ResourceAttachment,
  Submission,
  Transaction,
  UserAccount,
  WebsiteConfig,
} from './src/types/kwan.ts';

const app = express();
app.use(express.json({ limit: '30mb' }));

const corsOrigins = new Set(
  (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use((req, res, next) => {
  const origin = req.header('Origin');
  if (!origin || !corsOrigins.has(origin)) {
    next();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.vary('Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;

function stripSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSensitiveFields);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== 'password').map(([key, item]) => [key, stripSensitiveFields(item)])
    );
  }
  return value;
}

app.use((_req, res, next) => {
  const json = res.json.bind(res);
  res.json = ((body: unknown) => json(stripSensitiveFields(body))) as typeof res.json;
  next();
});

app.use('/api', (_req, res, next) => {
  if (process.env.VERCEL === '1' && !process.env.SESSION_SECRET) {
    res.status(503).json({ error: 'Set SESSION_SECRET in the Vercel project environment.' });
    return;
  }
  next();
});

app.use('/api', databaseMiddleware);

const UPLOADS_DIR = path.resolve(process.cwd(), 'data/uploads');
const RESOURCE_FILES_DIR = path.resolve(process.cwd(), 'data/resource-files');
const MAX_RESOURCE_FILE_BYTES = 20 * 1024 * 1024;
const MAX_CMS_IMAGE_BYTES = 8 * 1024 * 1024;
const VERCEL_RUNTIME = process.env.VERCEL === '1';
const CMS_IMAGE_MIME_TYPES: Record<string, string> = {
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};
const RESOURCE_MIME_TYPES: Record<string, string> = {
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.rtf': 'application/rtf',
  '.txt': 'text/plain',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
if (!fs.existsSync(UPLOADS_DIR)) {
  if (!VERCEL_RUNTIME) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Ensure generated assets and uploaded CMS promotional banners resolve cleanly in dev and production
app.use('/src/assets', express.static(path.resolve(process.cwd(), 'src/assets')));
if (!VERCEL_RUNTIME) app.use('/uploads', express.static(UPLOADS_DIR));

function blobToken(access: 'public' | 'private'): string {
  const token =
    access === 'public'
      ? process.env.BLOB_PUBLIC_READ_WRITE_TOKEN
      : process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(`Configure BLOB_${access.toUpperCase()}_READ_WRITE_TOKEN in Vercel.`);
  }
  return token;
}

function asyncRoute(
  handler: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>
): express.RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}

function readableFromWeb(stream: ReadableStream<Uint8Array>): Readable {
  return Readable.from(
    (async function* () {
      const reader = stream.getReader();
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) return;
          yield chunk.value;
        }
      } finally {
        reader.releaseLock();
      }
    })()
  );
}

function nowLabel() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function createSession(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS })
  ).toString('base64url');
  const signature = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function authenticatedUser(req: express.Request, db: ReturnType<typeof getDb>): UserAccount | undefined {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const [payload, signature, extra] = token?.split('.') || [];
  if (!payload || !signature || extra) return undefined;
  const expected = createHmac('sha256', SESSION_SECRET).update(payload).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return undefined;

  let claims: { userId?: unknown; expiresAt?: unknown };
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as typeof claims;
  } catch {
    return undefined;
  }
  const userId =
    typeof claims.userId === 'string' &&
    typeof claims.expiresAt === 'number' &&
    claims.expiresAt > Math.floor(Date.now() / 1000)
      ? claims.userId
      : undefined;
  return userId ? db.users.find((user) => user.id === userId) : undefined;
}

type ResourceWriteBody = Partial<ResourceItem> & {
  attachmentDataUrl?: string;
  attachmentFileName?: string;
  attachmentBlobPath?: string;
  removeAttachment?: boolean;
};

async function storeResourceAttachment(
  fileName: string | undefined,
  dataUrl: string | undefined,
  blobPathname?: string
): Promise<{ attachment: ResourceAttachment } | { error: string; status: number }> {
  if (typeof fileName !== 'string' || !fileName) {
    return { error: 'Choose a supported resource file to upload.', status: 400 };
  }
  const safeName = path.basename(fileName.replace(/\\/g, '/')).replace(/[\x00-\x1f\x7f]/g, '').trim();
  const extension = path.extname(safeName).toLowerCase();
  const mimeType = RESOURCE_MIME_TYPES[extension];
  if (!safeName || safeName.length > 180 || !mimeType) {
    return {
      error: 'Supported files: PDF, Word, PowerPoint, Excel, OpenDocument, CSV, RTF, TXT, PNG, and JPG.',
      status: 400,
    };
  }

  if (VERCEL_RUNTIME) {
    const pathMatch = blobPathname?.match(/^resource-files\/([a-f0-9]{32})$/);
    if (!pathMatch) {
      return { error: 'Upload the resource file to Vercel Blob before saving it.', status: 400 };
    }
    const blob = await head(blobPathname!, { token: blobToken('private') });
    if (blob.size === 0 || blob.size > MAX_RESOURCE_FILE_BYTES) {
      return { error: 'Resource files must be between 1 byte and 20 MB.', status: 413 };
    }
    if (blob.contentType !== mimeType && blob.contentType !== 'application/octet-stream') {
      return { error: 'The file type does not match its filename.', status: 400 };
    }
    return {
      attachment: {
        fileId: pathMatch[1],
        fileName: safeName,
        mimeType,
        sizeBytes: blob.size,
      },
    };
  }

  if (typeof dataUrl !== 'string' || !dataUrl) {
    return { error: 'Choose a supported resource file to upload.', status: 400 };
  }
  const dataUrlMatch = dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!dataUrlMatch || dataUrlMatch[2].length % 4 !== 0) {
    return { error: 'The uploaded file data is invalid.', status: 400 };
  }
  const declaredMimeType = dataUrlMatch[1].toLowerCase();
  if (declaredMimeType !== mimeType && declaredMimeType !== 'application/octet-stream') {
    return { error: 'The file type does not match its filename.', status: 400 };
  }

  const buffer = Buffer.from(dataUrlMatch[2], 'base64');
  if (buffer.byteLength === 0) {
    return { error: 'The uploaded file is empty.', status: 400 };
  }
  if (buffer.byteLength > MAX_RESOURCE_FILE_BYTES) {
    return { error: 'Resource files must be 20 MB or smaller.', status: 413 };
  }

  const fileId = randomBytes(16).toString('hex');
  try {
    fs.mkdirSync(RESOURCE_FILES_DIR, { recursive: true });
    fs.writeFileSync(path.join(RESOURCE_FILES_DIR, fileId), buffer, { flag: 'wx' });
  } catch (error) {
    console.error('Unable to store a resource attachment.', error);
    return { error: 'Unable to store the resource file. Please try again.', status: 500 };
  }
  return {
    attachment: {
      fileId,
      fileName: safeName,
      mimeType,
      sizeBytes: buffer.byteLength,
    },
  };
}

async function removeResourceAttachment(attachment?: ResourceAttachment): Promise<void> {
  if (!attachment || !/^[a-f0-9]{32}$/.test(attachment.fileId)) return;
  if (VERCEL_RUNTIME) {
    await del(`resource-files/${attachment.fileId}`, { token: blobToken('private') });
    return;
  }
  const filePath = path.join(RESOURCE_FILES_DIR, attachment.fileId);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

app.post(
  '/api/blob-upload',
  asyncRoute(async (req, res) => {
    const body = req.body as HandleUploadBody;
    const isCompletion = body?.type === 'blob.upload-completed';
    const pathname =
      body?.type === 'blob.upload-completed'
        ? body.payload.blob.pathname
        : body?.type === 'blob.generate-client-token'
        ? body.payload.pathname
        : undefined;
    const resourcePath = typeof pathname === 'string' && /^resource-files\/[a-f0-9]{32}$/.test(pathname);
    const cmsPath = typeof pathname === 'string' && /^cms-banners\/[\w-]+\.(png|jpe?g|webp|gif|svg)$/i.test(pathname);
    if (!resourcePath && !cmsPath) {
      res.status(400).json({ error: 'Unsupported upload path.' });
      return;
    }

    if (!isCompletion && authenticatedUser(req, getDb())?.role !== 'admin') {
      res.status(403).json({ error: 'Only an authenticated administrator can upload files.' });
      return;
    }

    const access = resourcePath ? 'private' : 'public';
    const response = await handleUpload({
      token: blobToken(access),
      request: req,
      body,
      onBeforeGenerateToken: async (requestedPath, clientPayload) => {
        const isResourceUpload = resourcePath && clientPayload === 'resource';
        const isCmsUpload = cmsPath && clientPayload === 'cms';
        if (
          requestedPath !== pathname ||
          (!isResourceUpload && !isCmsUpload)
        ) {
          throw new Error('The requested upload is not permitted.');
        }
        return isResourceUpload
          ? {
              allowedContentTypes: [...new Set(Object.values(RESOURCE_MIME_TYPES))],
              maximumSizeInBytes: MAX_RESOURCE_FILE_BYTES,
              addRandomSuffix: false,
            }
          : {
              allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'],
              maximumSizeInBytes: MAX_CMS_IMAGE_BYTES,
              addRandomSuffix: false,
            };
      },
    });
    res.json(response);
  })
);

// Get full platform state
app.get('/api/state', (_req, res) => {
  res.json(getDb());
});

// Authentication & Get Started Registration
app.get('/api/auth/setup-status', (_req, res) => {
  const admin = getDb().users.find((user) => user.role === 'admin');
  res.json({
    required: !admin?.password,
    setupKeyConfigured: Boolean(process.env.ADMIN_SETUP_KEY?.trim()),
  });
});

app.post('/api/auth/setup-admin', (req, res) => {
  const db = getDb();
  const admin = db.users.find((user) => user.role === 'admin');
  if (!admin) {
    res.status(500).json({ error: 'Administrator account is unavailable.' });
    return;
  }
  if (admin.password) {
    res.status(409).json({ error: 'Administrator setup has already been completed.' });
    return;
  }

  const setupKey = process.env.ADMIN_SETUP_KEY?.trim();
  const suppliedKey = typeof req.body?.setupKey === 'string' ? req.body.setupKey : '';
  if (!setupKey) {
    res.status(503).json({ error: 'Set ADMIN_SETUP_KEY in the server environment before setting up the admin account.' });
    return;
  }
  const expected = Buffer.from(setupKey);
  const supplied = Buffer.from(suppliedKey);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    res.status(403).json({ error: 'Invalid administrator setup key.' });
    return;
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password.length < 12) {
    res.status(400).json({ error: 'Administrator password must be at least 12 characters long.' });
    return;
  }

  admin.name = 'Ayen Geoffrey Alexander';
  admin.password = hashPassword(password);
  saveDb(db);
  const sessionToken = createSession(admin.id);
  res.status(201).json({ user: admin, sessionToken });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const db = getDb();
  const user = db.users.find(
    (u) =>
      u.email.toLowerCase() === String(email || '').trim().toLowerCase() &&
      Boolean(u.password) &&
      verifyPassword(String(password || ''), u.password!)
  );
  if (!user || (user.role === 'tutor' && !user.approved)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }
  res.json({ user, sessionToken: createSession(user.id) });
});

app.get('/api/auth/me', (req, res) => {
  const user = authenticatedUser(req, getDb());
  if (!user) {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return;
  }
  res.json({ user });
});

app.post('/api/auth/register', (req, res) => {
  const body = req.body as Partial<UserAccount> & { confirmPassword?: string };
  const db = getDb();
  if (body.role && body.role !== 'student') {
    res.status(403).json({ error: 'Public registration is limited to student accounts. Tutors are added by an administrator.' });
    return;
  }
  if (!body.name?.trim() || !body.email?.trim() || !body.password) {
    res.status(400).json({ error: 'Name, email, and password are required.' });
    return;
  }
  if (body.password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }
  if (body.confirmPassword !== undefined && body.password !== body.confirmPassword) {
    res.status(400).json({ error: 'Password and confirm password do not match.' });
    return;
  }
  const exists = db.users.some((u) => u.email.toLowerCase() === body.email!.trim().toLowerCase());
  if (exists) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const role = 'student';
  const freeAccessibleCourses =
    role === 'student' && body.classLevel
      ? db.courses
          .filter(
            (c) =>
              c.status === 'published' &&
              c.accessType === 'free' &&
              c.division === body.division &&
              c.allowedClasses.includes(body.classLevel!)
          )
          .map((c) => c.id)
      : [];

  const newUser: UserAccount = {
    id: `u-${Date.now()}`,
    name: body.name.trim(),
    email: body.email.trim(),
    password: hashPassword(body.password),
    role,
    division: role === 'student' ? body.division : undefined,
    classLevel: role === 'student' ? body.classLevel : undefined,
    stream: role === 'student' && body.division === 'upper_secondary' ? body.stream : undefined,
    subjectCombination:
      role === 'student' && body.division === 'upper_secondary' ? body.subjectCombination : undefined,
    guardianName: role === 'student' && body.division === 'primary' ? body.guardianName : undefined,
    guardianContact: role === 'student' && body.division === 'primary' ? body.guardianContact : undefined,
    approved: true,
    assignedCourseIds: [],
    enrolledCourseIds: freeAccessibleCourses,
    purchasedResourceIds: [],
    completedLessonIds: [],
    stars: role === 'student' && body.division === 'primary' ? 3 : 0,
    badges: role === 'student' && body.division === 'primary' ? ['Welcome Explorer'] : [],
    joinedAt: todayDate(),
  };

  db.users.push(newUser);
  saveDb(db);
  res.status(201).json({ user: newUser, state: db, sessionToken: createSession(newUser.id) });
});

app.post('/api/admin/tutors', (req, res) => {
  const db = getDb();
  const admin = authenticatedUser(req, db);
  if (admin?.role !== 'admin') {
    res.status(403).json({ error: 'Only an authenticated administrator can create tutor accounts.' });
    return;
  }

  const body = req.body as { name?: string; email?: string; password?: string };
  const name = body.name?.trim();
  const email = body.email?.trim();
  const password = body.password || '';
  if (!name || !email || password.length < 12) {
    res.status(400).json({ error: 'Tutor name, email, and a temporary password of at least 12 characters are required.' });
    return;
  }
  if (db.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const tutor: UserAccount = {
    id: `u-${Date.now()}`,
    name,
    email,
    password: hashPassword(password),
    role: 'tutor',
    approved: !db.settings.requireTutorApproval,
    assignedCourseIds: [],
    enrolledCourseIds: [],
    purchasedResourceIds: [],
    completedLessonIds: [],
    stars: 0,
    badges: [],
    joinedAt: todayDate(),
  };
  db.users.push(tutor);
  saveDb(db);
  res.status(201).json({ user: tutor, state: db });
});

// Courses CRUD & Class Access Management
app.post('/api/courses', (req, res) => {
  const db = getDb();
  const body = req.body as Partial<Course>;
  if (!body.title || !body.division || !body.allowedClasses?.length) {
    res.status(400).json({ error: 'Course title, division, and target classes are required.' });
    return;
  }

  const tutor = db.users.find((u) => u.id === body.tutorId) || db.users.find((u) => u.role === 'tutor' && u.approved);

  const course: Course = {
    id: `c-${Date.now()}`,
    title: body.title.trim(),
    subject: body.subject || body.title.trim(),
    code: body.code || `KW-${Math.floor(100 + Math.random() * 899)}`,
    summary: body.summary || 'Structured division-specific course created in KWAN Admin.',
    division: body.division,
    allowedClasses: body.allowedClasses,
    subjectCombinationTag: body.subjectCombinationTag,
    tutorId: tutor?.id || 'u-tut-1',
    tutorName: tutor?.name || 'KWAN Faculty',
    accessType: body.accessType || 'free',
    priceUGX: body.accessType === 'paid' ? Number(body.priceUGX || 45000) : 0,
    status: body.status || 'published',
    thumbnailUrl:
      body.thumbnailUrl ||
      (body.division === 'primary'
        ? '/src/assets/images/division_primary_1794577152032.jpg'
        : body.division === 'lower_secondary'
        ? '/src/assets/images/division_lower_secondary_1794577152479.jpg'
        : '/src/assets/images/division_upper_secondary_1794577153179.jpg'),
    accentColor: body.division === 'primary' ? '#F59E0B' : body.division === 'lower_secondary' ? '#1D4ED8' : '#B45309',
    modules: body.modules?.length
      ? body.modules
      : [
          {
            id: `m-${Date.now()}`,
            title: 'Module 1: Core Foundations',
            description: `Tailored specifically for ${body.allowedClasses.join(', ')} learners.`,
            lessons: [
              {
                id: `l-${Date.now()}`,
                title: `Introduction to ${body.title}`,
                type: body.division === 'primary' ? 'interactive' : body.division === 'lower_secondary' ? 'video' : 'reading',
                durationMinutes: body.division === 'primary' ? 12 : 25,
                summary: 'Foundational concepts and worked examples.',
                content: body.summary || 'Structured KWAN lesson content.',
              },
            ],
          },
        ],
    assessments: body.assessments?.length
      ? body.assessments
      : [
          {
            id: `a-${Date.now()}`,
            title: `${body.title} Mastery Assessment`,
            type: body.division === 'upper_secondary' ? 'research' : 'assignment',
            instructions: 'Complete the division-appropriate exercise and submit for tutor marking.',
            maxScore: 30,
            minPassScore: 21,
            dueLabel: 'End of Module',
          },
        ],
    createdAt: todayDate(),
  };

  db.courses.unshift(course);
  if (tutor) {
    tutor.assignedCourseIds = Array.from(new Set([...(tutor.assignedCourseIds || []), course.id]));
  }
  saveDb(db);
  res.status(201).json({ course, state: db });
});

app.patch('/api/courses/:id', (req, res) => {
  const db = getDb();
  const idx = db.courses.findIndex((c) => c.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Course not found.' });
    return;
  }
  db.courses[idx] = { ...db.courses[idx], ...(req.body as Partial<Course>) };
  saveDb(db);
  res.json({ course: db.courses[idx], state: db });
});

// Enroll or Purchase Course / Resource via KWAN
app.post('/api/purchase', (req, res) => {
  const { userId, itemType, itemId, method } = req.body as {
    userId: string;
    itemType: 'course' | 'resource';
    itemId: string;
    method?: Transaction['method'];
  };
  const db = getDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  let title = '';
  let amount = 0;
  let division: DivisionId | undefined = user.division;

  if (itemType === 'course') {
    const course = db.courses.find((c) => c.id === itemId);
    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }
    if (user.role === 'student' && user.classLevel && !course.allowedClasses.includes(user.classLevel)) {
      res.status(403).json({ error: `Course is restricted to ${course.allowedClasses.join(', ')}.` });
      return;
    }
    title = course.title;
    amount = course.accessType === 'paid' ? course.priceUGX : 0;
    division = course.division;
    if (!user.enrolledCourseIds.includes(course.id)) {
      user.enrolledCourseIds.push(course.id);
    }
  } else {
    const resource = db.resources.find((r) => r.id === itemId);
    if (!resource) {
      res.status(404).json({ error: 'Resource not found.' });
      return;
    }
    title = resource.title;
    amount = resource.accessType === 'paid' ? resource.priceUGX : 0;
    division = resource.division;
    resource.downloads += 1;
    if (!user.purchasedResourceIds.includes(resource.id)) {
      user.purchasedResourceIds.push(resource.id);
    }
  }

  if (amount > 0) {
    const commissionRate = db.settings.platformCommissionPercent / 100;
    const commissionUGX = Math.round(amount * commissionRate);
    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      userId: user.id,
      userName: user.name,
      division,
      itemType,
      itemId,
      itemTitle: title,
      amountUGX: amount,
      commissionUGX,
      tutorNetUGX: amount - commissionUGX,
      method: method || 'MTN Mobile Money',
      status: 'completed',
      createdAt: nowLabel(),
    };
    db.transactions.unshift(tx);
  }

  saveDb(db);
  res.json({ user, state: db });
});

// Mark Lesson Complete (updates stars for Primary learners)
app.post('/api/lessons/complete', (req, res) => {
  const { userId, lessonId } = req.body as { userId: string; lessonId: string };
  const db = getDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  if (!user.completedLessonIds.includes(lessonId)) {
    user.completedLessonIds.push(lessonId);
    if (user.division === 'primary') {
      user.stars += 2;
    }
  }
  saveDb(db);
  res.json({ user, state: db });
});

// Student Assignment / Quiz / Research Submission
app.post('/api/submissions', (req, res) => {
  const db = getDb();
  const body = req.body as Partial<Submission>;
  if (!body.studentId || !body.courseId || !body.assessmentId || !body.answerText) {
    res.status(400).json({ error: 'Missing required submission fields.' });
    return;
  }
  const student = db.users.find((u) => u.id === body.studentId);
  const course = db.courses.find((c) => c.id === body.courseId);
  const assessment = course?.assessments.find((a) => a.id === body.assessmentId);
  if (!student || !course || !assessment) {
    res.status(404).json({ error: 'Student, course, or assessment not found.' });
    return;
  }

  const sub: Submission = {
    id: `sub-${Date.now()}`,
    studentId: student.id,
    studentName: student.name,
    division: course.division,
    classLevel: student.classLevel || course.allowedClasses[0],
    courseId: course.id,
    courseTitle: course.title,
    assessmentId: assessment.id,
    assessmentTitle: assessment.title,
    answerText: body.answerText,
    attachmentName: body.attachmentName,
    status: body.status === 'marked' ? 'marked' : 'submitted',
    score: body.score,
    maxScore: assessment.maxScore,
    tutorFeedback: body.tutorFeedback,
    greenPenNotes: body.greenPenNotes,
    redPenNotes: body.redPenNotes,
    submittedAt: nowLabel(),
    markedAt: body.status === 'marked' ? nowLabel() : undefined,
  };

  db.submissions.unshift(sub);
  if (student.division === 'primary') {
    student.stars += 3;
  }
  saveDb(db);
  res.status(201).json({ submission: sub, state: db });
});

// Tutor / Admin Red & Green Pen Marking + Rubric Grading
app.patch('/api/submissions/:id/mark', (req, res) => {
  const db = getDb();
  const sub = db.submissions.find((s) => s.id === req.params.id);
  if (!sub) {
    res.status(404).json({ error: 'Submission not found.' });
    return;
  }
  const { score, redPenNotes, greenPenNotes, rubricBreakdown, tutorFeedback, markedBy } = req.body as Partial<Submission>;

  sub.status = 'marked';
  sub.score = Number(score ?? sub.maxScore);
  sub.redPenNotes = redPenNotes || [];
  sub.greenPenNotes = greenPenNotes || [];
  sub.rubricBreakdown = rubricBreakdown;
  sub.tutorFeedback = tutorFeedback || 'Marked by KWAN educator.';
  sub.markedBy = markedBy || 'KWAN Faculty';
  sub.markedAt = nowLabel();

  saveDb(db);
  res.json({ submission: sub, state: db });
});

// Persistent Course Discussion Forum (Students post questions; Tutors provide answers under specific course topics)
app.post('/api/forum/threads', (req, res) => {
  const db = getDb();
  const { courseId, topicId, topicTitle, authorId, title, body } = req.body as {
    courseId?: string;
    topicId?: string;
    topicTitle?: string;
    authorId?: string;
    title?: string;
    body?: string;
  };

  if (!courseId || !authorId || !title?.trim() || !body?.trim()) {
    res.status(400).json({ error: 'Course, author, question title, and details are required.' });
    return;
  }

  const course = db.courses.find((c) => c.id === courseId);
  const author = db.users.find((u) => u.id === authorId);
  if (!course || !author) {
    res.status(404).json({ error: 'Course or user account not found.' });
    return;
  }

  const matchedModule = course.modules.find((m) => m.id === topicId);
  const resolvedTopicId = matchedModule?.id || topicId || course.modules[0]?.id || 'general';
  const resolvedTopicTitle =
    topicTitle?.trim() || matchedModule?.title || course.modules[0]?.title || 'General Course Discussion';

  const thread: ForumThread = {
    id: `ft-${Date.now()}`,
    division: course.division,
    courseId: course.id,
    courseTitle: course.title,
    topicId: resolvedTopicId,
    topicTitle: resolvedTopicTitle,
    authorId: author.id,
    authorName: author.name,
    authorClassLevel: author.classLevel,
    title: title.trim(),
    body: body.trim(),
    status: 'open',
    createdAt: nowLabel(),
    replies: [],
  };

  db.forumThreads = [thread, ...(db.forumThreads || [])];
  saveDb(db);
  res.status(201).json({ thread, state: db });
});

app.post('/api/forum/threads/:id/replies', (req, res) => {
  const db = getDb();
  const thread = (db.forumThreads || []).find((t) => t.id === req.params.id);
  if (!thread) {
    res.status(404).json({ error: 'Discussion thread not found.' });
    return;
  }

  const { authorId, body } = req.body as { authorId?: string; body?: string };
  if (!authorId || !body?.trim()) {
    res.status(400).json({ error: 'Reply author and message are required.' });
    return;
  }

  const author = db.users.find((u) => u.id === authorId);
  if (!author) {
    res.status(404).json({ error: 'User account not found.' });
    return;
  }

  const isOfficialAnswer = author.role === 'tutor' || author.role === 'admin';
  const reply: ForumReply = {
    id: `fr-${Date.now()}`,
    authorId: author.id,
    authorName: author.name,
    authorRole: author.role,
    authorClassOrTitle:
      author.role === 'tutor'
        ? 'Subject Tutor'
        : author.role === 'admin'
        ? 'Academic Administrator'
        : author.classLevel || 'Student',
    body: body.trim(),
    createdAt: nowLabel(),
    isOfficialAnswer,
  };

  thread.replies.push(reply);
  if (isOfficialAnswer && thread.status === 'open') {
    thread.status = 'answered';
  }

  saveDb(db);
  res.status(201).json({ thread, reply, state: db });
});

app.patch('/api/forum/threads/:id/status', (req, res) => {
  const db = getDb();
  const thread = (db.forumThreads || []).find((t) => t.id === req.params.id);
  if (!thread) {
    res.status(404).json({ error: 'Discussion thread not found.' });
    return;
  }
  const { status } = req.body as { status?: ForumThread['status'] };
  if (status !== 'open' && status !== 'answered' && status !== 'resolved') {
    res.status(400).json({ error: 'Invalid discussion status.' });
    return;
  }
  thread.status = status;
  saveDb(db);
  res.json({ thread, state: db });
});

// Blog Management & Comments
app.post('/api/blog', (req, res) => {
  const db = getDb();
  const body = req.body as Partial<BlogPost>;
  if (!body.title || !body.content) {
    res.status(400).json({ error: 'Title and content are required.' });
    return;
  }
  const post: BlogPost = {
    id: `blog-${Date.now()}`,
    title: body.title.trim(),
    slug: body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    category: body.category || 'KWAN Announcements',
    tags: body.tags || ['KWAN'],
    excerpt: body.excerpt || body.content.slice(0, 140),
    content: body.content,
    imageUrl: body.imageUrl || '/src/assets/images/blog_exam_prep_1794577153176.jpg',
    authorName: body.authorName || 'KWAN Editorial Team',
    status: body.status || 'published',
    publishedAt: body.publishedAt || todayDate(),
    views: 1,
    commentsEnabled: body.commentsEnabled ?? true,
    comments: [],
  };
  db.blogPosts.unshift(post);
  saveDb(db);
  res.status(201).json({ post, state: db });
});

app.patch('/api/blog/:id', (req, res) => {
  const db = getDb();
  const idx = db.blogPosts.findIndex((b) => b.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Article not found.' });
    return;
  }
  db.blogPosts[idx] = { ...db.blogPosts[idx], ...(req.body as Partial<BlogPost>) };
  saveDb(db);
  res.json({ post: db.blogPosts[idx], state: db });
});

app.delete('/api/blog/:id', (req, res) => {
  const db = getDb();
  db.blogPosts = db.blogPosts.filter((b) => b.id !== req.params.id);
  saveDb(db);
  res.json({ state: db });
});

app.post('/api/blog/:id/comments', (req, res) => {
  const db = getDb();
  const post = db.blogPosts.find((b) => b.id === req.params.id);
  if (!post) {
    res.status(404).json({ error: 'Article not found.' });
    return;
  }
  const { authorName, text } = req.body as { authorName?: string; text?: string };
  if (!text?.trim()) {
    res.status(400).json({ error: 'Comment text required.' });
    return;
  }
  post.comments.push({
    id: `bc-${Date.now()}`,
    authorName: authorName?.trim() || 'Reader',
    text: text.trim(),
    createdAt: todayDate(),
  });
  saveDb(db);
  res.json({ post, state: db });
});

// Resources Management
app.post('/api/resources', asyncRoute(async (req, res) => {
  const db = getDb();
  if (authenticatedUser(req, db)?.role !== 'admin') {
    res.status(403).json({ error: 'Only an authenticated administrator can create resources.' });
    return;
  }
  const {
    attachmentDataUrl,
    attachmentFileName,
    attachmentBlobPath,
    attachment: _submittedAttachment,
    ...body
  } = req.body as ResourceWriteBody;
  if (!body.title || !body.division) {
    res.status(400).json({ error: 'Title and division are required.' });
    return;
  }
  let attachment: ResourceAttachment | undefined;
  if (attachmentDataUrl || attachmentFileName || attachmentBlobPath) {
    const stored = await storeResourceAttachment(attachmentFileName, attachmentDataUrl, attachmentBlobPath);
    if ('error' in stored) {
      res.status(stored.status).json({ error: stored.error });
      return;
    }
    attachment = stored.attachment;
  }
  const item: ResourceItem = {
    id: `res-${Date.now()}`,
    title: body.title.trim(),
    category: body.category || 'General',
    division: body.division,
    targetClasses: body.targetClasses || ['P.4'],
    accessType: body.accessType || 'free',
    priceUGX: body.accessType === 'paid' ? Number(body.priceUGX || 15000) : 0,
    format: body.format || 'PDF Notes',
    description: body.description || 'Approved KWAN study material.',
    previewContent: body.previewContent || 'Includes structured topic notes and worked questions.',
    authorName: body.authorName || 'KWAN Curriculum Team',
    approved: body.approved ?? true,
    downloads: 0,
    attachment,
  };
  db.resources.unshift(item);
  saveDb(db);
  res.status(201).json({ resource: item, state: db });
}));

app.get('/api/resources/:id/file', asyncRoute(async (req, res) => {
  const db = getDb();
  const resource = db.resources.find((item) => item.id === req.params.id);
  if (!resource?.attachment) {
    res.status(404).json({ error: 'Resource file not found.' });
    return;
  }
  const user = authenticatedUser(req, db);
  if (!user) {
    res.status(401).json({ error: 'Sign in to access resource files.' });
    return;
  }
  if (
    user.role !== 'admin' &&
    (!resource.approved ||
      (resource.accessType === 'paid' && !user.purchasedResourceIds.includes(resource.id)))
  ) {
    res.status(403).json({ error: 'Purchase or obtain approval for this resource before downloading it.' });
    return;
  }

  const fileId = resource.attachment.fileId;
  if (!/^[a-f0-9]{32}$/.test(fileId)) {
    res.status(404).json({ error: 'Resource file is unavailable.' });
    return;
  }
  const filePath = path.join(RESOURCE_FILES_DIR, fileId);
  const blob = VERCEL_RUNTIME
    ? await get(`resource-files/${fileId}`, { access: 'private', token: blobToken('private') })
    : undefined;
  if (VERCEL_RUNTIME ? !blob : !fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Resource file is unavailable.' });
    return;
  }

  const headerName = resource.attachment.fileName;
  const fallbackName = headerName.replace(/[^\x20-\x7e]|["\\;]/g, '_');
  res.setHeader('Content-Type', resource.attachment.mimeType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(headerName)}`
  );
  res.setHeader('X-Resource-Filename', encodeURIComponent(headerName));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  resource.downloads += 1;
  saveDb(db);
  await persistDbRequest();

  let stream: NodeJS.ReadableStream;
  if (VERCEL_RUNTIME) {
    if (!blob?.stream) {
      res.status(404).json({ error: 'Resource file is unavailable.' });
      return;
    }
    stream = readableFromWeb(blob.stream);
  } else {
    stream = fs.createReadStream(filePath);
  }
  stream.on('error', () => {
    if (!res.headersSent) res.status(500).json({ error: 'Unable to read the resource file.' });
    else res.destroy();
  });
  stream.pipe(res);
}));

app.patch('/api/resources/:id', asyncRoute(async (req, res) => {
  const db = getDb();
  if (authenticatedUser(req, db)?.role !== 'admin') {
    res.status(403).json({ error: 'Only an authenticated administrator can update resources.' });
    return;
  }
  const idx = db.resources.findIndex((r) => r.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }
  const {
    attachmentDataUrl,
    attachmentFileName,
    attachmentBlobPath,
    removeAttachment,
    attachment: _submittedAttachment,
    ...updates
  } = req.body as ResourceWriteBody;
  const previousAttachment = db.resources[idx].attachment;
  let nextAttachment = previousAttachment;
  if (attachmentDataUrl || attachmentFileName || attachmentBlobPath) {
    const stored = await storeResourceAttachment(attachmentFileName, attachmentDataUrl, attachmentBlobPath);
    if ('error' in stored) {
      res.status(stored.status).json({ error: stored.error });
      return;
    }
    nextAttachment = stored.attachment;
  } else if (removeAttachment) {
    nextAttachment = undefined;
  }
  db.resources[idx] = {
    ...db.resources[idx],
    ...updates,
    attachment: nextAttachment,
  };
  saveDb(db);
  if (previousAttachment && previousAttachment.fileId !== nextAttachment?.fileId) {
    await persistDbRequest();
    await removeResourceAttachment(previousAttachment);
  }
  res.json({ resource: db.resources[idx], state: db });
}));

app.delete('/api/resources/:id', asyncRoute(async (req, res) => {
  const db = getDb();
  if (authenticatedUser(req, db)?.role !== 'admin') {
    res.status(403).json({ error: 'Only an authenticated administrator can delete resources.' });
    return;
  }
  const resourceExists = db.resources.some((resource) => resource.id === req.params.id);
  if (!resourceExists) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }
  const resourceToDelete = db.resources.find((item) => item.id === req.params.id);
  db.resources = db.resources.filter((item) => item.id !== req.params.id);
  for (const user of db.users) {
    user.purchasedResourceIds = user.purchasedResourceIds.filter((id) => id !== req.params.id);
  }
  saveDb(db);
  await persistDbRequest();
  await removeResourceAttachment(resourceToDelete?.attachment);
  res.json({ state: db });
}));

// User / Tutor / Student Management
app.patch('/api/users/:id', (req, res) => {
  const db = getDb();
  if (authenticatedUser(req, db)?.role !== 'admin') {
    res.status(403).json({ error: 'Only an authenticated administrator can manage user accounts.' });
    return;
  }
  const idx = db.users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const { password: _password, ...updates } = req.body as Partial<UserAccount>;
  db.users[idx] = { ...db.users[idx], ...updates };
  saveDb(db);
  res.json({ user: db.users[idx], state: db });
});

// Payments & Refunds
app.post('/api/payments/:id/refund', (req, res) => {
  const db = getDb();
  const tx = db.transactions.find((t) => t.id === req.params.id);
  if (!tx) {
    res.status(404).json({ error: 'Transaction not found.' });
    return;
  }
  tx.status = 'refunded';
  saveDb(db);
  res.json({ transaction: tx, state: db });
});

// CMS Website Designer: Save Draft, Publish Live, Restore Version
app.post('/api/cms/draft', (req, res) => {
  const db = getDb();
  db.cmsDraft = req.body as WebsiteConfig;
  saveDb(db);
  res.json({ state: db });
});

app.post('/api/cms/publish', (req, res) => {
  const db = getDb();
  const { config, label, savedBy } = req.body as { config: WebsiteConfig; label?: string; savedBy?: string };
  db.cmsDraft = structuredClone(config);
  db.cmsPublished = structuredClone(config);
  db.cmsHistory.unshift({
    id: `ver-${Date.now()}`,
    label: label || `Published Update (${nowLabel()})`,
    savedAt: nowLabel(),
    savedBy: savedBy || 'KWAN Administrator',
    config: structuredClone(config),
  });
  if (db.cmsHistory.length > 15) {
    db.cmsHistory = db.cmsHistory.slice(0, 15);
  }
  saveDb(db);
  res.json({ state: db });
});

app.post('/api/cms/restore/:versionId', (req, res) => {
  const db = getDb();
  const snap = db.cmsHistory.find((v) => v.id === req.params.versionId);
  if (!snap) {
    res.status(404).json({ error: 'Version snapshot not found.' });
    return;
  }
  db.cmsDraft = structuredClone(snap.config);
  db.cmsPublished = structuredClone(snap.config);
  saveDb(db);
  res.json({ state: db });
});

// Upload Promotional Banner Image to CMS Media Library
app.post('/api/cms/upload', asyncRoute(async (req, res) => {
  if (authenticatedUser(req, getDb())?.role !== 'admin') {
    res.status(403).json({ error: 'Only an authenticated administrator can upload CMS media.' });
    return;
  }
  const { filename, dataUrl, blobPathname, label, uploadedBy } = req.body as {
    filename?: string;
    dataUrl?: string;
    blobPathname?: string;
    label?: string;
    uploadedBy?: string;
  };
  if (typeof filename !== 'string' || !filename.trim()) {
    res.status(400).json({ error: 'Choose an image file to upload.' });
    return;
  }

  const safeFilename = path.basename(filename.replace(/\\/g, '/')).replace(/[\x00-\x1f\x7f]/g, '').trim();
  const rawExt = path.extname(safeFilename).slice(1).toLowerCase();
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const mimeType = CMS_IMAGE_MIME_TYPES[rawExt];
  if (!mimeType) {
    res.status(400).json({ error: 'Only PNG, JPG, WEBP, GIF, or SVG image files are supported.' });
    return;
  }
  const cleanBase = safeFilename
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 40) || 'banner';
  const storedName = `banner-${Date.now()}-${cleanBase}.${ext}`;
  let assetUrl: string;
  let fileSize: number;

  if (VERCEL_RUNTIME) {
    if (
      typeof blobPathname !== 'string' ||
      !/^cms-banners\/[\w-]+\.(png|jpe?g|webp|gif|svg)$/i.test(blobPathname)
    ) {
      res.status(400).json({ error: 'Upload the image to Vercel Blob before saving it.' });
      return;
    }
    const blob = await head(blobPathname, { token: blobToken('public') });
    if (blob.size === 0 || blob.size > MAX_CMS_IMAGE_BYTES || blob.contentType !== mimeType) {
      res.status(400).json({ error: 'The uploaded image is invalid or exceeds the 8 MB limit.' });
      return;
    }
    assetUrl = blob.url;
    fileSize = blob.size;
  } else {
    if (!dataUrl || typeof dataUrl !== 'string') {
      res.status(400).json({ error: 'Image file data is required.' });
      return;
    }
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,([A-Za-z0-9+/]+={0,2})$/i);
    if (!match) {
      res.status(400).json({ error: 'Only PNG, JPG, WEBP, GIF, or SVG image files are supported.' });
      return;
    }
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_CMS_IMAGE_BYTES) {
      res.status(413).json({ error: 'Image must be between 1 byte and 8 MB.' });
      return;
    }
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(UPLOADS_DIR, storedName), buffer);
    assetUrl = `/uploads/${storedName}`;
    fileSize = buffer.byteLength;
  }

  const db = getDb();
  const asset: CmsMediaAsset = {
    id: `media-${Date.now()}`,
    label: label?.trim() || cleanBase.replace(/_/g, ' '),
    url: assetUrl,
    uploadedAt: todayDate(),
    uploadedBy: uploadedBy || 'KWAN Administrator',
    fileSizeKB: Math.max(1, Math.round(fileSize / 1024)),
  };
  db.cmsMedia = [asset, ...(db.cmsMedia || [])];
  saveDb(db);
  res.status(201).json({ asset, state: db });
}));

app.delete('/api/cms/media/:id', asyncRoute(async (req, res) => {
  if (authenticatedUser(req, getDb())?.role !== 'admin') {
    res.status(403).json({ error: 'Only an authenticated administrator can delete CMS media.' });
    return;
  }
  const db = getDb();
  const target = (db.cmsMedia || []).find((m) => m.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'Media asset not found.' });
    return;
  }
  if (target.url.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, path.basename(target.url));
    if (!VERCEL_RUNTIME && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } else if (VERCEL_RUNTIME && target.url.includes('.public.blob.vercel-storage.com/')) {
    await del(target.url, { token: blobToken('public') });
  }
  db.cmsMedia = (db.cmsMedia || []).filter((m) => m.id !== req.params.id);
  saveDb(db);
  res.json({ state: db });
}));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Settings
app.patch('/api/settings', (req, res) => {
  const db = getDb();
  db.settings = { ...db.settings, ...(req.body as Partial<typeof db.settings>) };
  saveDb(db);
  res.json({ state: db });
});

async function startServer() {
  const preferredPort = Number(process.env.PORT || 3000);
  const httpServer = http.createServer(app);

  const listenOnPort = (port: number) => {
    httpServer.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE' && port < preferredPort + 10) {
        const nextPort = port + 1;
        console.warn(`Port ${port} is busy. Retrying on ${nextPort}.`);
        listenOnPort(nextPort);
        return;
      }
      throw error;
    });

    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`KWAN Education Platform running on http://0.0.0.0:${port}`);
    });
  };

  if (process.env.NODE_ENV !== 'production') {
    const viteReady = import('vite').then(({ createServer }) =>
      createServer({
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        },
        appType: 'spa',
      })
    );

    app.use(async (req, res, next) => {
      try {
        const vite = await viteReady;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  listenOnPort(preferredPort);
}

export default app;

if (process.env.VERCEL !== '1') {
  void startServer();
}

app.use('/api', (err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API request failed.', err);
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(500).json({ error: 'The API request failed. Please try again.' });
});
