import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { getDb, saveDb } from './server/db.ts';
import type {
  BlogPost,
  CmsMediaAsset,
  Course,
  DivisionId,
  ForumReply,
  ForumThread,
  ResourceItem,
  Submission,
  Transaction,
  UserAccount,
  WebsiteConfig,
} from './src/types/kwan.ts';

const app = express();
app.use(express.json({ limit: '10mb' }));

const UPLOADS_DIR = path.resolve(process.cwd(), 'data/uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Ensure generated assets and uploaded CMS promotional banners resolve cleanly in dev and production
app.use('/src/assets', express.static(path.resolve(process.cwd(), 'src/assets')));
app.use('/uploads', express.static(UPLOADS_DIR));

function nowLabel() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

// Get full platform state
app.get('/api/state', (_req, res) => {
  res.json(getDb());
});

// Authentication & Get Started Registration
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const db = getDb();
  const user = db.users.find(
    (u) => u.email.toLowerCase() === String(email || '').trim().toLowerCase() && u.password === password
  );
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }
  res.json({ user });
});

app.post('/api/auth/register', (req, res) => {
  const body = req.body as Partial<UserAccount> & { confirmPassword?: string };
  const db = getDb();
  if (!body.name?.trim() || !body.email?.trim() || !body.password) {
    res.status(400).json({ error: 'Name, email, and password are required.' });
    return;
  }
  if (body.password.length < 4) {
    res.status(400).json({ error: 'Password must be at least 4 characters long.' });
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

  const role = body.role || 'student';
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
    password: body.password,
    role,
    division: role === 'student' ? body.division : undefined,
    classLevel: role === 'student' ? body.classLevel : undefined,
    stream: role === 'student' && body.division === 'upper_secondary' ? body.stream : undefined,
    subjectCombination:
      role === 'student' && body.division === 'upper_secondary' ? body.subjectCombination : undefined,
    guardianName: role === 'student' && body.division === 'primary' ? body.guardianName : undefined,
    guardianContact: role === 'student' && body.division === 'primary' ? body.guardianContact : undefined,
    approved: role === 'tutor' ? !db.settings.requireTutorApproval : true,
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
  res.status(201).json({ user: newUser, state: db });
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
app.post('/api/resources', (req, res) => {
  const db = getDb();
  const body = req.body as Partial<ResourceItem>;
  if (!body.title || !body.division) {
    res.status(400).json({ error: 'Title and division are required.' });
    return;
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
  };
  db.resources.unshift(item);
  saveDb(db);
  res.status(201).json({ resource: item, state: db });
});

app.patch('/api/resources/:id', (req, res) => {
  const db = getDb();
  const idx = db.resources.findIndex((r) => r.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Resource not found.' });
    return;
  }
  db.resources[idx] = { ...db.resources[idx], ...(req.body as Partial<ResourceItem>) };
  saveDb(db);
  res.json({ resource: db.resources[idx], state: db });
});

// User / Tutor / Student Management
app.patch('/api/users/:id', (req, res) => {
  const db = getDb();
  const idx = db.users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  db.users[idx] = { ...db.users[idx], ...(req.body as Partial<UserAccount>) };
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
app.post('/api/cms/upload', (req, res) => {
  const { filename, dataUrl, label, uploadedBy } = req.body as {
    filename?: string;
    dataUrl?: string;
    label?: string;
    uploadedBy?: string;
  };
  if (!dataUrl || typeof dataUrl !== 'string') {
    res.status(400).json({ error: 'Image file data is required.' });
    return;
  }

  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,(.+)$/i);
  if (!match) {
    res.status(400).json({ error: 'Only PNG, JPG, WEBP, GIF, or SVG image files are supported.' });
    return;
  }

  const rawExt = match[1].toLowerCase();
  const ext = rawExt === 'jpeg' ? 'jpg' : rawExt === 'svg+xml' ? 'svg' : rawExt;
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.byteLength > 8 * 1024 * 1024) {
    res.status(413).json({ error: 'Image exceeds the 8 MB upload limit.' });
    return;
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const cleanBase = (filename || 'banner')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 40) || 'banner';
  const storedName = `banner-${Date.now()}-${cleanBase}.${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, storedName), buffer);

  const db = getDb();
  const asset: CmsMediaAsset = {
    id: `media-${Date.now()}`,
    label: label?.trim() || cleanBase.replace(/_/g, ' '),
    url: `/uploads/${storedName}`,
    uploadedAt: todayDate(),
    uploadedBy: uploadedBy || 'KWAN Administrator',
    fileSizeKB: Math.max(1, Math.round(buffer.byteLength / 1024)),
  };
  db.cmsMedia = [asset, ...(db.cmsMedia || [])];
  saveDb(db);
  res.status(201).json({ asset, state: db });
});

app.delete('/api/cms/media/:id', (req, res) => {
  const db = getDb();
  const target = (db.cmsMedia || []).find((m) => m.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'Media asset not found.' });
    return;
  }
  if (target.url.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, path.basename(target.url));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  db.cmsMedia = (db.cmsMedia || []).filter((m) => m.id !== req.params.id);
  saveDb(db);
  res.json({ state: db });
});

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
  const PORT = 3000;
  const httpServer = http.createServer(app);

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

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`KWAN Education Platform running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
