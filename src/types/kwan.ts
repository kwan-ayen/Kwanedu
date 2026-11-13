export type DivisionId = 'primary' | 'lower_secondary' | 'upper_secondary';

export type PrimaryClass = 'P.4' | 'P.5' | 'P.6' | 'P.7';
export type LowerSecondaryClass = 'S.1' | 'S.2' | 'S.3' | 'S.4';
export type UpperSecondaryClass = 'S.5' | 'S.6';
export type ClassLevel = PrimaryClass | LowerSecondaryClass | UpperSecondaryClass;

export type UserRole = 'student' | 'tutor' | 'admin';
export type UpperSecondaryStream = 'Sciences' | 'Arts';

export type PublicPageId = 'home' | 'about' | 'blog' | 'resources' | 'get_started' | 'login';

export type CmsEditablePageId = 'home' | 'about' | 'blog' | 'resources' | 'get_started';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  division?: DivisionId;
  classLevel?: ClassLevel;
  stream?: UpperSecondaryStream;
  subjectCombination?: string;
  guardianName?: string;
  guardianContact?: string;
  approved: boolean;
  assignedCourseIds?: string[];
  enrolledCourseIds: string[];
  purchasedResourceIds: string[];
  completedLessonIds: string[];
  stars: number;
  badges: string[];
  joinedAt: string;
}

export interface PracticeQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonItem {
  id: string;
  title: string;
  type: 'video' | 'reading' | 'interactive' | 'practical';
  durationMinutes: number;
  summary: string;
  content: string;
  videoTranscript?: string;
  interactiveKind?: 'fractions' | 'science_cell' | 'calculus_slope';
  downloadableNoteTitle?: string;
  practiceQuestions?: PracticeQuestion[];
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  lessons: LessonItem[];
}

export interface RubricCriterion {
  id: string;
  label: string;
  maxMarks: number;
  descriptor: string;
}

export interface AssessmentItem {
  id: string;
  title: string;
  type: 'practice' | 'quiz' | 'assignment' | 'homework' | 'research' | 'practical' | 'exam_prep';
  instructions: string;
  maxScore: number;
  minPassScore: number;
  dueLabel: string;
  rubric?: RubricCriterion[];
  questions?: PracticeQuestion[];
}

export interface Course {
  id: string;
  title: string;
  subject: string;
  code: string;
  summary: string;
  division: DivisionId;
  allowedClasses: ClassLevel[];
  subjectCombinationTag?: string;
  tutorId: string;
  tutorName: string;
  accessType: 'free' | 'paid';
  priceUGX: number;
  status: 'published' | 'pending_approval' | 'draft';
  thumbnailUrl: string;
  accentColor: string;
  modules: CourseModule[];
  assessments: AssessmentItem[];
  createdAt: string;
}

export interface Submission {
  id: string;
  studentId: string;
  studentName: string;
  division: DivisionId;
  classLevel: ClassLevel;
  courseId: string;
  courseTitle: string;
  assessmentId: string;
  assessmentTitle: string;
  answerText: string;
  attachmentName?: string;
  status: 'submitted' | 'marked';
  score?: number;
  maxScore: number;
  redPenNotes?: string[];
  greenPenNotes?: string[];
  rubricBreakdown?: { criterionId: string; label: string; awarded: number; maxMarks: number }[];
  tutorFeedback?: string;
  markedBy?: string;
  submittedAt: string;
  markedAt?: string;
}

export interface ForumReply {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorClassOrTitle?: string;
  body: string;
  createdAt: string;
  isOfficialAnswer: boolean;
}

export interface ForumThread {
  id: string;
  division: DivisionId;
  courseId: string;
  courseTitle: string;
  topicId: string;
  topicTitle: string;
  authorId: string;
  authorName: string;
  authorClassLevel?: ClassLevel;
  title: string;
  body: string;
  status: 'open' | 'answered' | 'resolved';
  createdAt: string;
  replies: ForumReply[];
}

export type BlogCategory =
  | 'Education News'
  | 'Study Tips'
  | 'Examination Preparation'
  | 'Science and Technology'
  | 'Career Guidance'
  | 'KWAN Announcements'
  | 'Learning Resources';

export interface BlogComment {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: BlogCategory;
  tags: string[];
  excerpt: string;
  content: string;
  imageUrl: string;
  authorName: string;
  status: 'published' | 'draft' | 'scheduled';
  publishedAt: string;
  views: number;
  commentsEnabled: boolean;
  comments: BlogComment[];
}

export interface ResourceItem {
  id: string;
  title: string;
  category: string;
  division: DivisionId;
  targetClasses: ClassLevel[];
  accessType: 'free' | 'paid';
  priceUGX: number;
  format: 'PDF Notes' | 'Past Paper Pack' | 'Lab Guide' | 'Revision Workbook';
  description: string;
  previewContent: string;
  authorName: string;
  approved: boolean;
  downloads: number;
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  division?: DivisionId;
  itemType: 'course' | 'resource';
  itemId: string;
  itemTitle: string;
  amountUGX: number;
  commissionUGX: number;
  tutorNetUGX: number;
  method: 'MTN Mobile Money' | 'Airtel Money' | 'Card';
  status: 'completed' | 'refunded';
  createdAt: string;
}

export interface CmsMediaAsset {
  id: string;
  label: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  fileSizeKB?: number;
}

export interface HeroSlide {
  id: string;
  imageUrl: string;
  divisionLabel: string;
  title?: string;
  caption: string;
  ctaLabel?: string;
  ctaTarget?: PublicPageId;
  divisionParam?: DivisionId;
  active?: boolean;
}

export interface WebsiteSection {
  id: string;
  type:
    | 'hero'
    | 'divisions'
    | 'featured_courses'
    | 'promo_banner'
    | 'mission_pillars'
    | 'testimonials'
    | 'cta_band';
  heading: string;
  subheading: string;
  bodyText: string;
  ctaLabel: string;
  ctaTarget: PublicPageId;
  backgroundColor: string;
  textColor: string;
  imageUrl?: string;
  slides?: HeroSlide[];
  sliderAutoplay?: boolean;
  sliderIntervalSeconds?: number;
  visible: boolean;
}

export interface WebsiteConfig {
  brandName: string;
  navItems: { id: PublicPageId; label: string }[];
  theme: {
    primaryAccent: string;
    secondaryAccent: string;
    headingFont: 'Bricolage Grotesque' | 'Outfit' | 'Plus Jakarta Sans' | 'Fraunces';
    bodyFont: 'Figtree' | 'Plus Jakarta Sans' | 'Outfit';
    buttonStyle: 'rounded-lg' | 'rounded-md' | 'rounded-none';
  };
  footer: {
    tagline: string;
    contactEmail: string;
    location: string;
    copyright: string;
  };
  pages: Record<CmsEditablePageId, WebsiteSection[]>;
}

export interface WebsiteVersionSnapshot {
  id: string;
  label: string;
  savedAt: string;
  savedBy: string;
  config: WebsiteConfig;
}

export interface DivisionConfig {
  id: DivisionId;
  name: string;
  ageRange: string;
  classes: ClassLevel[];
  curriculumFocus: string;
  interfaceStyle: string;
  progressionRule: string;
}

export interface PlatformSettings {
  platformName: string;
  currency: 'UGX';
  platformCommissionPercent: number;
  allowStudentSelfRegistration: boolean;
  requireTutorApproval: boolean;
  supportEmail: string;
}

export interface PlatformState {
  divisions: DivisionConfig[];
  users: UserAccount[];
  courses: Course[];
  submissions: Submission[];
  forumThreads: ForumThread[];
  blogPosts: BlogPost[];
  resources: ResourceItem[];
  transactions: Transaction[];
  cmsDraft: WebsiteConfig;
  cmsPublished: WebsiteConfig;
  cmsHistory: WebsiteVersionSnapshot[];
  cmsMedia: CmsMediaAsset[];
  settings: PlatformSettings;
}
