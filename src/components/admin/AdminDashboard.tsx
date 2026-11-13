import { useRef, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Download,
  FileUp,
  FolderKanban,
  Globe,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  PenSquare,
  Plus,
  Settings,
  Trash2,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type {
  BlogCategory,
  BlogPost,
  ClassLevel,
  DivisionId,
  PlatformState,
  ResourceItem,
  ResourceAttachment,
  Submission,
  UserAccount,
} from '../../types/kwan';
import { api, DIVISION_META, formatUGX, SUBJECT_COMBINATIONS } from '../../lib/api';
import { WebsiteDesigner } from './WebsiteDesigner';
import { MarkingModal } from '../shared/MarkingModal';

type AdminArea =
  | 'dashboard'
  | 'website'
  | 'blog'
  | 'divisions'
  | 'classes'
  | 'courses'
  | 'tutors'
  | 'students'
  | 'assessments'
  | 'resources'
  | 'payments'
  | 'finance'
  | 'reports'
  | 'settings';

const ADMIN_NAV: { id: AdminArea; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'website', label: 'Website Management', icon: Globe },
  { id: 'blog', label: 'Blog Management', icon: PenSquare },
  { id: 'divisions', label: 'Academic Divisions', icon: Layers },
  { id: 'classes', label: 'Class Management', icon: GraduationCap },
  { id: 'courses', label: 'Course Management', icon: BookOpen },
  { id: 'tutors', label: 'Tutor Management', icon: UserCheck },
  { id: 'students', label: 'Student Management', icon: Users },
  { id: 'assessments', label: 'Assessment Management', icon: ClipboardCheck },
  { id: 'resources', label: 'Resources Management', icon: FolderKanban },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'finance', label: 'Finance', icon: Wallet },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const BLOG_CATEGORIES: BlogCategory[] = [
  'Education News',
  'Study Tips',
  'Examination Preparation',
  'Science and Technology',
  'Career Guidance',
  'KWAN Announcements',
  'Learning Resources',
];

const RESOURCE_FILE_ACCEPT = '.csv,.doc,.docx,.jpeg,.jpg,.odt,.odp,.ods,.pdf,.png,.ppt,.pptx,.rtf,.txt,.xls,.xlsx';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Unable to read the selected file.'));
    };
    reader.onerror = () => reject(new Error('Unable to read the selected file.'));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(sizeBytes: number): string {
  return sizeBytes >= 1024 * 1024
    ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

interface AdminDashboardProps {
  state: PlatformState;
  user: UserAccount;
  onStateChange: (next: PlatformState) => void;
  onPreviewDivision: (division: DivisionId) => void;
  onLogout: () => void;
}

export function AdminDashboard({
  state,
  user,
  onStateChange,
  onPreviewDivision,
  onLogout,
}: AdminDashboardProps) {
  const [area, setArea] = useState<AdminArea>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Course Builder State
  const [courseTitle, setCourseTitle] = useState('');
  const [courseSubject, setCourseSubject] = useState('Mathematics');
  const [courseSummary, setCourseSummary] = useState('');
  const [courseDivision, setCourseDivision] = useState<DivisionId>('primary');
  const [courseClasses, setCourseClasses] = useState<ClassLevel[]>(['P.4', 'P.5']);
  const [courseTutorId, setCourseTutorId] = useState(
    state.users.find((u) => u.role === 'tutor' && u.approved)?.id || ''
  );
  const [courseAccess, setCourseAccess] = useState<'free' | 'paid'>('free');
  const [coursePrice, setCoursePrice] = useState(45000);
  const [courseNotice, setCourseNotice] = useState('');

  // Blog Editor State
  const [editingBlogId, setEditingBlogId] = useState<string | null>(null);
  const [blogTitle, setBlogTitle] = useState('');
  const [blogCategory, setBlogCategory] = useState<BlogCategory>('Education News');
  const [blogTags, setBlogTags] = useState('KWAN, Curriculum');
  const [blogExcerpt, setBlogExcerpt] = useState('');
  const [blogContent, setBlogContent] = useState('');
  const [blogStatus, setBlogStatus] = useState<BlogPost['status']>('published');
  const [blogImage, setBlogImage] = useState('/src/assets/images/blog_exam_prep_1794577153176.jpg');

  // Assessment Marking Modal
  const [markingTarget, setMarkingTarget] = useState<Submission | null>(null);
  const [assessmentFilter, setAssessmentFilter] = useState<'all' | 'submitted' | 'marked'>('all');

  // Resource Builder State
  const [resTitle, setResTitle] = useState('');
  const [resDescription, setResDescription] = useState('');
  const [resPreviewContent, setResPreviewContent] = useState('');
  const [resCategory, setResCategory] = useState('General');
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [resDivision, setResDivision] = useState<DivisionId>('lower_secondary');
  const [resAccess, setResAccess] = useState<'free' | 'paid'>('free');
  const [resPrice, setResPrice] = useState(15000);
  const [resFormat, setResFormat] = useState<ResourceItem['format']>('PDF Notes');
  const [resFile, setResFile] = useState<File | null>(null);
  const [resCurrentAttachment, setResCurrentAttachment] = useState<ResourceAttachment | undefined>();
  const [removeResAttachment, setRemoveResAttachment] = useState(false);
  const [resError, setResError] = useState('');
  const [savingResource, setSavingResource] = useState(false);
  const resourceFileInput = useRef<HTMLInputElement>(null);

  const [newTutorName, setNewTutorName] = useState('');
  const [newTutorEmail, setNewTutorEmail] = useState('');
  const [newTutorPassword, setNewTutorPassword] = useState('');
  const [newTutorError, setNewTutorError] = useState('');
  const [newTutorNotice, setNewTutorNotice] = useState('');
  const [creatingTutor, setCreatingTutor] = useState(false);

  // Settings State
  const [settingsDraft, setSettingsDraft] = useState(state.settings);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const students = state.users.filter((u) => u.role === 'student');
  const tutors = state.users.filter((u) => u.role === 'tutor');
  const completedTx = state.transactions.filter((t) => t.status === 'completed');
  const grossRevenue = completedTx.reduce((s, t) => s + t.amountUGX, 0);
  const totalCommission = completedTx.reduce((s, t) => s + t.commissionUGX, 0);
  const pendingSubmissions = state.submissions.filter((s) => s.status === 'submitted');
  const pendingTutors = tutors.filter((t) => !t.approved);

  const toggleClass = (cls: ClassLevel) => {
    setCourseClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim() || courseClasses.length === 0) return;
    const res = await api.createCourse({
      title: courseTitle.trim(),
      subject: courseSubject.trim() || courseTitle.trim(),
      summary: courseSummary.trim() || `Structured course for ${courseClasses.join(', ')}.`,
      division: courseDivision,
      allowedClasses: courseClasses,
      tutorId: courseTutorId,
      accessType: courseAccess,
      priceUGX: courseAccess === 'paid' ? coursePrice : 0,
      status: 'published',
    });
    onStateChange(res.state);
    setCourseTitle('');
    setCourseSummary('');
    setCourseNotice('Course created and target class permissions activated.');
    setTimeout(() => setCourseNotice(''), 3500);
  };

  const handleCreateTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewTutorError('');
    if (newTutorPassword.length < 12) {
      setNewTutorError('Use a temporary password with at least 12 characters.');
      return;
    }
    setCreatingTutor(true);
    try {
      const result = await api.createTutor({
        name: newTutorName.trim(),
        email: newTutorEmail.trim(),
        password: newTutorPassword,
      });
      onStateChange(result.state);
      setNewTutorName('');
      setNewTutorEmail('');
      setNewTutorPassword('');
      setNewTutorNotice(
        result.user.approved
          ? 'Tutor account created and approved.'
          : 'Tutor account created. Approve it before the tutor can sign in.'
      );
      window.setTimeout(() => setNewTutorNotice(''), 4000);
    } catch (err) {
      setNewTutorError(err instanceof Error ? err.message : 'Unable to create the tutor account.');
    } finally {
      setCreatingTutor(false);
    }
  };

  const resetResourceForm = () => {
    setEditingResourceId(null);
    setResTitle('');
    setResDescription('');
    setResPreviewContent('');
    setResCategory('General');
    setResFile(null);
    setResCurrentAttachment(undefined);
    setRemoveResAttachment(false);
    setResError('');
    if (resourceFileInput.current) resourceFileInput.current.value = '';
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim()) return;
    setResError('');
    setSavingResource(true);
    try {
      const attachmentFields = resFile
        ? {
            attachmentDataUrl: await readFileAsDataUrl(resFile),
            attachmentFileName: resFile.name,
          }
        : editingResourceId && removeResAttachment
        ? { removeAttachment: true }
        : {};
      const payload = {
        title: resTitle.trim(),
        division: resDivision,
        targetClasses: DIVISION_META[resDivision].classes,
        accessType: resAccess,
        priceUGX: resAccess === 'paid' ? resPrice : 0,
        format: resFormat,
        category: resCategory.trim() || 'General',
        description: resDescription.trim(),
        previewContent: resPreviewContent.trim(),
        approved: editingResourceId
          ? state.resources.find((resource) => resource.id === editingResourceId)?.approved ?? true
          : true,
        authorName: user.name,
        ...attachmentFields,
      };
      const result = editingResourceId
        ? await api.updateResource(editingResourceId, payload)
        : await api.createResource(payload);
      onStateChange(result.state);
      resetResourceForm();
    } catch (err) {
      setResError(err instanceof Error ? err.message : 'Unable to save the resource.');
    } finally {
      setSavingResource(false);
    }
  };

  const handleSaveBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blogTitle.trim() || !blogContent.trim()) return;
    const payload = {
      title: blogTitle.trim(),
      category: blogCategory,
      tags: blogTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      excerpt: blogExcerpt.trim() || blogContent.trim().slice(0, 140),
      content: blogContent.trim(),
      status: blogStatus,
      imageUrl: blogImage,
      authorName: user.name,
    };
    const res = editingBlogId
      ? await api.updateBlogPost(editingBlogId, payload)
      : await api.createBlogPost(payload);
    onStateChange(res.state);
    setEditingBlogId(null);
    setBlogTitle('');
    setBlogExcerpt('');
    setBlogContent('');
  };

  const exportCsvReport = () => {
    const rows = [
      ['TransactionID', 'Learner', 'Division', 'Item', 'AmountUGX', 'CommissionUGX', 'Status', 'Date'],
      ...state.transactions.map((t) => [
        t.id,
        t.userName,
        t.division || '',
        t.itemTitle.replace(/,/g, ' '),
        String(t.amountUGX),
        String(t.commissionUGX),
        t.status,
        t.createdAt,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kwan_academic_financial_report.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-animated-canvas text-slate-900 flex">
      {/* Admin Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white text-slate-900 flex flex-col border-r border-slate-200 shadow-soft transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-4 border-b border-slate-200/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/kwan-mark.svg" alt="" aria-hidden="true" className="w-9 h-9 rounded-xl shadow-sm" />
            <div>
              <p className="text-base font-bold text-slate-950 tracking-tight">KWAN Admin</p>
              <p className="text-[11px] text-slate-600">Central Governance</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-slate-500 hover:text-slate-950"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = area === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setArea(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#E6F2F2] text-[#0F4C81] shadow-sm'
                    : 'text-slate-700 hover:bg-[#F4F7F6] hover:text-[#0F4C81]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200/70 space-y-2">
          <p className="text-[11px] text-slate-600 font-medium">Preview Division Classrooms</p>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => onPreviewDivision('primary')}
              className="px-2 py-1.5 text-[11px] font-semibold bg-amber-100/80 text-amber-950 border border-amber-200 rounded hover:bg-amber-200/80"
            >
              P.4–P.7
            </button>
            <button
              type="button"
              onClick={() => onPreviewDivision('lower_secondary')}
              className="px-2 py-1.5 text-[11px] font-semibold bg-teal-100/80 text-teal-950 border border-teal-200 rounded hover:bg-teal-200/80"
            >
              S.1–S.4
            </button>
            <button
              type="button"
              onClick={() => onPreviewDivision('upper_secondary')}
              className="px-2 py-1.5 text-[11px] font-semibold bg-stone-200/80 text-stone-900 border border-stone-300 rounded hover:bg-stone-300/80"
            >
              S.5–S.6
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="glass-header-footer border-b border-[#1D5E96] px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-30 text-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-white bg-white/10 border border-white/30 rounded-lg"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div>
              <p className="text-xs text-[#E2E8F0]">KWAN Administration / {ADMIN_NAV.find((n) => n.id === area)?.label}</p>
              <h1 className="text-base font-bold text-white">
                {ADMIN_NAV.find((n) => n.id === area)?.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs font-medium text-[#E2E8F0]">{user.name}</span>
            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-white/10 border border-white/30 rounded-lg hover:bg-white/20 flex items-center gap-1.5 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </header>

        <main className="p-6 max-w-7xl w-full mx-auto space-y-6 flex-1">
          {/* 1. DASHBOARD */}
          {area === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="glass-card rounded-xl p-5">
                  <p className="text-xs text-slate-500">Total Registered Learners</p>
                  <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">{students.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Across P.4–S.6 divisions</p>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <p className="text-xs text-slate-500">Published Courses</p>
                  <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">
                    {state.courses.filter((c) => c.status === 'published').length}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{pendingTutors.length} tutor(s) awaiting approval</p>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <p className="text-xs text-slate-500">Gross Platform Revenue</p>
                  <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">{formatUGX(grossRevenue)}</p>
                  <p className="text-xs text-emerald-700 mt-1">KWAN Net: {formatUGX(totalCommission)}</p>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <p className="text-xs text-slate-500">Marked Submissions</p>
                  <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">
                    {state.submissions.filter((s) => s.status === 'marked').length}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{pendingSubmissions.length} submission(s) to mark</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {(['primary', 'lower_secondary', 'upper_secondary'] as const).map((divId) => {
                  const divStudents = students.filter((s) => s.division === divId).length;
                  const divCourses = state.courses.filter((c) => c.division === divId).length;
                  const divMarked = state.submissions.filter(
                    (s) => s.division === divId && s.status === 'marked'
                  ).length;
                  return (
                    <div key={divId} className="glass-card rounded-xl p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-900">{DIVISION_META[divId].label}</h2>
                        <span className="text-xs font-mono-tabular text-slate-500">{DIVISION_META[divId].badgeText}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-slate-500">Students</p>
                          <p className="font-bold font-mono-tabular text-slate-900">{divStudents}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Courses</p>
                          <p className="font-bold font-mono-tabular text-slate-900">{divCourses}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Marked Work</p>
                          <p className="font-bold font-mono-tabular text-slate-900">{divMarked}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onPreviewDivision(divId)}
                        className="w-full px-3 py-2 text-xs font-semibold text-amber-950 bg-amber-50/80 border border-amber-200 rounded-lg hover:bg-amber-100/80"
                      >
                        Inspect {DIVISION_META[divId].short} Learning UI
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. WEBSITE MANAGEMENT */}
          {area === 'website' && (
            <WebsiteDesigner state={state} adminName={user.name} onStateChange={onStateChange} />
          )}

          {/* 3. BLOG MANAGEMENT */}
          {area === 'blog' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleSaveBlog}
                className="lg:col-span-5 glass-card rounded-xl p-5 space-y-3"
              >
                <h2 className="text-sm font-bold text-slate-900">
                  {editingBlogId ? 'Edit Article' : 'Publish New Blog Article'}
                </h2>
                <input
                  type="text"
                  required
                  value={blogTitle}
                  onChange={(e) => setBlogTitle(e.target.value)}
                  placeholder="Article title"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={blogCategory}
                    onChange={(e) => setBlogCategory(e.target.value as BlogCategory)}
                    className="px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                  >
                    {BLOG_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    value={blogStatus}
                    onChange={(e) => setBlogStatus(e.target.value as BlogPost['status'])}
                    className="px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={blogTags}
                  onChange={(e) => setBlogTags(e.target.value)}
                  placeholder="Tags (comma-separated)"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                />
                <select
                  value={blogImage}
                  onChange={(e) => setBlogImage(e.target.value)}
                  className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                >
                  <option value="/src/assets/images/blog_exam_prep_1794577153176.jpg">Exam Prep Desk Photo</option>
                  <option value="/src/assets/images/hero_kwan_learning_1794577150584.jpg">Sunlit Library Photo</option>
                  <option value="/src/assets/images/division_primary_1794577152032.jpg">Primary Classroom Photo</option>
                  <option value="/src/assets/images/division_lower_secondary_1794577152479.jpg">Lower Secondary Lab Photo</option>
                  <option value="/src/assets/images/division_upper_secondary_1794577153179.jpg">Upper Secondary Reading Hall</option>
                </select>
                <input
                  type="text"
                  value={blogExcerpt}
                  onChange={(e) => setBlogExcerpt(e.target.value)}
                  placeholder="Short article summary"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                />
                <textarea
                  rows={5}
                  required
                  value={blogContent}
                  onChange={(e) => setBlogContent(e.target.value)}
                  placeholder="Write full article content..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                />
                <button
                  type="submit"
                  className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                >
                  {editingBlogId ? 'Save Article Changes' : 'Save & Publish Article'}
                </button>
              </form>

              <div className="lg:col-span-7 glass-card rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/50 border-b border-slate-200/80 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Article</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Views</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {state.blogPosts.map((post) => (
                      <tr key={post.id}>
                        <td className="px-4 py-3 font-semibold text-slate-900">{post.title}</td>
                        <td className="px-4 py-3 text-slate-600">{post.category}</td>
                        <td className="px-4 py-3 text-slate-700">{post.status}</td>
                        <td className="px-4 py-3 text-right font-mono-tabular">{post.views}</td>
                        <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBlogId(post.id);
                              setBlogTitle(post.title);
                              setBlogCategory(post.category);
                              setBlogTags(post.tags.join(', '));
                              setBlogExcerpt(post.excerpt);
                              setBlogContent(post.content);
                              setBlogStatus(post.status);
                              setBlogImage(post.imageUrl);
                            }}
                            className="text-amber-800 font-semibold hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await api.deleteBlogPost(post.id);
                              onStateChange(res.state);
                            }}
                            className="text-red-700 hover:underline inline-flex items-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. ACADEMIC DIVISIONS */}
          {area === 'divisions' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {state.divisions.map((div) => (
                <div key={div.id} className="glass-card rounded-xl p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">{div.name}</h2>
                    <span className="text-xs font-mono-tabular text-teal-800 font-semibold">{div.classes.join('–')}</span>
                  </div>
                  <p className="text-xs text-slate-500">{div.ageRange}</p>
                  <div className="text-xs text-slate-700 space-y-2 pt-2 border-t border-slate-200/70">
                    <p>
                      <strong>Curriculum Focus:</strong> {div.curriculumFocus}
                    </p>
                    <p>
                      <strong>Learning Interface:</strong> {div.interfaceStyle}
                    </p>
                    <p>
                      <strong>Progression Benchmark:</strong> {div.progressionRule}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPreviewDivision(div.id)}
                    className="w-full mt-2 px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                  >
                    Launch {div.name} UI
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 5. CLASS MANAGEMENT */}
          {area === 'classes' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {(['P.4', 'P.5', 'P.6', 'P.7', 'S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'] as ClassLevel[]).map(
                  (cls) => {
                    const countStudents = students.filter((s) => s.classLevel === cls).length;
                    const countCourses = state.courses.filter((c) => c.allowedClasses.includes(cls)).length;
                    return (
                      <div key={cls} className="glass-card rounded-xl p-4 space-y-1">
                        <p className="text-base font-bold text-slate-900">{cls}</p>
                        <p className="text-xs text-slate-600 tabular-nums">{countStudents} student(s)</p>
                        <p className="text-xs text-teal-700 font-semibold tabular-nums">{countCourses} course(s)</p>
                      </div>
                    );
                  }
                )}
              </div>

              <div className="glass-card rounded-xl p-5">
                <h2 className="text-sm font-bold text-slate-900 mb-3">
                  Upper Secondary (S.5–S.6) Approved Subject Combinations
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                  {SUBJECT_COMBINATIONS.map((combo) => (
                    <div key={combo} className="glass-panel rounded-lg px-3 py-2">
                      {combo}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 6. COURSE MANAGEMENT & TARGET CLASS SELECTOR */}
          {area === 'courses' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleCreateCourse}
                className="lg:col-span-5 glass-card rounded-xl p-6 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-700" />
                  <h2 className="text-sm font-bold text-slate-900">Create a Course & Assign Class Access</h2>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Course Title</label>
                  <input
                    type="text"
                    required
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    placeholder="e.g. Mathematics"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Subject</label>
                    <input
                      type="text"
                      value={courseSubject}
                      onChange={(e) => setCourseSubject(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Academic Division</label>
                    <select
                      value={courseDivision}
                      onChange={(e) => {
                        const nextDiv = e.target.value as DivisionId;
                        setCourseDivision(nextDiv);
                        setCourseClasses(DIVISION_META[nextDiv].classes.slice(0, 2));
                      }}
                      className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="primary">Primary (P.4–P.7)</option>
                      <option value="lower_secondary">Lower Secondary (S.1–S.4)</option>
                      <option value="upper_secondary">Upper Secondary (S.5–S.6)</option>
                    </select>
                  </div>
                </div>

                <div className="glass-panel rounded-lg p-3 space-y-2.5">
                  <p className="text-xs font-bold text-slate-900">Who can access this course?</p>
                  {(['primary', 'lower_secondary', 'upper_secondary'] as const).map((div) => (
                    <div key={div} className="space-y-1">
                      <p className="text-[11px] font-semibold text-slate-600">{DIVISION_META[div].short}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {DIVISION_META[div].classes.map((cls) => {
                          const selected = courseClasses.includes(cls);
                          return (
                            <button
                              key={cls}
                              type="button"
                              onClick={() => toggleClass(cls)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors ${
                                selected
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white/80 text-slate-700 border-slate-300 hover:bg-white'
                              }`}
                            >
                              {cls}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-600 pt-1">
                    <strong>Selected classes:</strong> {courseClasses.join(', ') || 'None'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Course Summary</label>
                  <textarea
                    rows={2}
                    value={courseSummary}
                    onChange={(e) => setCourseSummary(e.target.value)}
                    placeholder="Division-appropriate curriculum scope..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Assign Approved Tutor</label>
                    <select
                      value={courseTutorId}
                      onChange={(e) => setCourseTutorId(e.target.value)}
                      className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      {tutors
                        .filter((t) => t.approved)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Access Pricing</label>
                    <select
                      value={courseAccess}
                      onChange={(e) => setCourseAccess(e.target.value as 'free' | 'paid')}
                      className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="free">Free Access</option>
                      <option value="paid">Paid (UGX)</option>
                    </select>
                  </div>
                </div>

                {courseAccess === 'paid' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Price (UGX)</label>
                    <input
                      type="number"
                      min={5000}
                      step={5000}
                      value={coursePrice}
                      onChange={(e) => setCoursePrice(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                {courseNotice && (
                  <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
                    {courseNotice}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                >
                  Create & Publish Course
                </button>
              </form>

              <div className="lg:col-span-7 glass-card rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/50 border-b border-slate-200/80 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Course</th>
                      <th className="px-4 py-3 font-semibold">Division</th>
                      <th className="px-4 py-3 font-semibold">Target Classes</th>
                      <th className="px-4 py-3 font-semibold">Access</th>
                      <th className="px-4 py-3 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {state.courses.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{c.title}</p>
                          <p className="text-[11px] text-slate-500">Tutor: {c.tutorName}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{DIVISION_META[c.division].short}</td>
                        <td className="px-4 py-3 font-mono-tabular text-slate-700">{c.allowedClasses.join(', ')}</td>
                        <td className="px-4 py-3 font-mono-tabular">{formatUGX(c.priceUGX)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              const nextStatus = c.status === 'published' ? 'draft' : 'published';
                              const res = await api.updateCourse(c.id, { status: nextStatus });
                              onStateChange(res.state);
                            }}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                              c.status === 'published'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {c.status}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. TUTOR MANAGEMENT */}
          {area === 'tutors' && (
            <div className="space-y-4">
              <form onSubmit={handleCreateTutor} className="glass-card rounded-xl p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Add a tutor</h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Tutor accounts can only be created here by an authenticated administrator. The tutor must use the temporary password you set.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="text-xs font-semibold text-slate-700">
                    Full name
                    <input
                      type="text"
                      required
                      value={newTutorName}
                      onChange={(e) => setNewTutorName(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Email address
                    <input
                      type="email"
                      required
                      value={newTutorEmail}
                      onChange={(e) => setNewTutorEmail(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Temporary password (12+ characters)
                    <input
                      type="password"
                      required
                      minLength={12}
                      autoComplete="new-password"
                      value={newTutorPassword}
                      onChange={(e) => setNewTutorPassword(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal"
                    />
                  </label>
                </div>
                {newTutorError && <p role="alert" className="text-xs font-medium text-red-700">{newTutorError}</p>}
                {newTutorNotice && <p role="status" className="text-xs font-medium text-emerald-700">{newTutorNotice}</p>}
                <button
                  type="submit"
                  disabled={creatingTutor}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#10B981] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#059669] disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {creatingTutor ? 'Creating tutor…' : 'Create tutor account'}
                </button>
              </form>

              <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/50 border-b border-slate-200/80 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tutor</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Assigned Courses</th>
                    <th className="px-4 py-3 font-semibold">Approval Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {tutors.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{t.name}</td>
                      <td className="px-4 py-3 text-slate-600">{t.email}</td>
                      <td className="px-4 py-3 font-mono-tabular">
                        {(t.assignedCourseIds || []).length} course(s)
                      </td>
                      <td className="px-4 py-3">
                        {t.approved ? (
                          <span className="text-emerald-700 font-semibold">Approved</span>
                        ) : (
                          <span className="text-amber-700 font-semibold">Pending Approval</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await api.updateUser(t.id, { approved: !t.approved });
                            onStateChange(res.state);
                          }}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                            t.approved
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              : 'bg-emerald-700 text-white hover:bg-emerald-800'
                          }`}
                        >
                          {t.approved ? 'Suspend' : 'Approve Tutor'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* 8. STUDENT MANAGEMENT */}
          {area === 'students' && (
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/50 border-b border-slate-200/80 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Learner</th>
                    <th className="px-4 py-3 font-semibold">Division</th>
                    <th className="px-4 py-3 font-semibold">Class</th>
                    <th className="px-4 py-3 font-semibold">Combination / Guardian</th>
                    <th className="px-4 py-3 font-semibold text-right">Enrolled Courses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{s.name}</p>
                        <p className="text-[11px] text-slate-500">{s.email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {s.division ? DIVISION_META[s.division].short : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={s.classLevel || 'P.4'}
                          onChange={async (e) => {
                            const nextClass = e.target.value as ClassLevel;
                            const nextDiv: DivisionId = nextClass.startsWith('P.')
                              ? 'primary'
                              : ['S.1', 'S.2', 'S.3', 'S.4'].includes(nextClass)
                              ? 'lower_secondary'
                              : 'upper_secondary';
                            const res = await api.updateUser(s.id, {
                              classLevel: nextClass,
                              division: nextDiv,
                            });
                            onStateChange(res.state);
                          }}
                          className="px-2 py-1 text-xs border border-slate-300 rounded bg-white/80"
                        >
                          {(['P.4', 'P.5', 'P.6', 'P.7', 'S.1', 'S.2', 'S.3', 'S.4', 'S.5', 'S.6'] as ClassLevel[]).map(
                            (cls) => (
                              <option key={cls} value={cls}>
                                {cls}
                              </option>
                            )
                          )}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.subjectCombination || (s.guardianName ? `Guardian: ${s.guardianName}` : 'Standard')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-tabular">{s.enrolledCourseIds.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 9. ASSESSMENT MANAGEMENT */}
          {area === 'assessments' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {(['all', 'submitted', 'marked'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setAssessmentFilter(f)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${
                      assessmentFilter === f ? 'bg-slate-900 text-white' : 'glass-panel text-slate-700 hover:bg-white/80'
                    }`}
                  >
                    {f === 'all' ? 'All Submissions' : f === 'submitted' ? 'Pending Marking' : 'Marked'}
                  </button>
                ))}
              </div>
              <div className="glass-card rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/50 border-b border-slate-200/80 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Division / Class</th>
                      <th className="px-4 py-3 font-semibold">Assessment</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-4 py-3 font-semibold text-right">Marking</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {state.submissions
                      .filter((s) => assessmentFilter === 'all' || s.status === assessmentFilter)
                      .map((sub) => (
                        <tr key={sub.id}>
                          <td className="px-4 py-3 font-semibold text-slate-900">{sub.studentName}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {DIVISION_META[sub.division].short} · {sub.classLevel}
                          </td>
                          <td className="px-4 py-3 text-slate-800">{sub.assessmentTitle}</td>
                          <td className="px-4 py-3 font-mono-tabular">
                            {sub.status === 'marked' ? `${sub.score}/${sub.maxScore}` : 'Pending'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setMarkingTarget(sub)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                            >
                              {sub.status === 'marked' ? 'Inspect / Edit Mark' : 'Mark Submission'}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 10. RESOURCES MANAGEMENT */}
          {area === 'resources' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleSaveResource}
                className="lg:col-span-4 glass-card rounded-xl p-5 space-y-3"
              >
                <h2 className="text-sm font-bold text-slate-900">{editingResourceId ? 'Edit Resource' : 'Add Approved Resource'}</h2>
                <input
                  type="text"
                  required
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  placeholder="Resource title"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                />
                <textarea
                  rows={2}
                  value={resDescription}
                  onChange={(e) => setResDescription(e.target.value)}
                  placeholder="Short description shown in resource listings"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                />
                <textarea
                  rows={4}
                  value={resPreviewContent}
                  onChange={(e) => setResPreviewContent(e.target.value)}
                  placeholder="Resource preview content learners can read"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                />
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-3">
                  <label htmlFor="resource-attachment" className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    <FileUp className="h-4 w-4 text-[#0F4C81]" />
                    Upload a resource file
                  </label>
                  <input
                    ref={resourceFileInput}
                    id="resource-attachment"
                    type="file"
                    accept={RESOURCE_FILE_ACCEPT}
                    onChange={(e) => {
                      setResFile(e.target.files?.[0] || null);
                      setRemoveResAttachment(false);
                      setResError('');
                    }}
                    className="mt-2 block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-[#E6F2F2] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#0F4C81] hover:file:bg-[#d8ebeb]"
                  />
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    PDF, Word, PowerPoint, Excel, OpenDocument, CSV, RTF, TXT, PNG or JPG · max 20 MB.
                  </p>
                  {resFile && (
                    <p className="mt-2 truncate text-[11px] font-medium text-[#0F4C81]">
                      Selected: {resFile.name} ({formatFileSize(resFile.size)})
                      {resCurrentAttachment ? ' · replaces current file on save' : ''}
                    </p>
                  )}
                  {!resFile && resCurrentAttachment && !removeResAttachment && (
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-slate-600">Attached: {resCurrentAttachment.fileName}</span>
                      <button
                        type="button"
                        onClick={() => setRemoveResAttachment(true)}
                        className="shrink-0 font-semibold text-red-700 hover:underline"
                      >
                        Remove file
                      </button>
                    </div>
                  )}
                  {removeResAttachment && (
                    <p className="mt-2 text-[11px] font-medium text-amber-800">The attached file will be removed when saved.</p>
                  )}
                </div>
                <input
                  type="text"
                  value={resCategory}
                  onChange={(e) => setResCategory(e.target.value)}
                  placeholder="Category (e.g. Mathematics)"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                />
                <select
                  value={resDivision}
                  onChange={(e) => setResDivision(e.target.value as DivisionId)}
                  className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                >
                  <option value="primary">Primary (P.4–P.7)</option>
                  <option value="lower_secondary">Lower Secondary (S.1–S.4)</option>
                  <option value="upper_secondary">Upper Secondary (S.5–S.6)</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={resFormat}
                    onChange={(e) => setResFormat(e.target.value as ResourceItem['format'])}
                    className="px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                  >
                    <option value="PDF Notes">PDF Notes</option>
                    <option value="Past Paper Pack">Past Paper Pack</option>
                    <option value="Lab Guide">Lab Guide</option>
                    <option value="Revision Workbook">Revision Workbook</option>
                  </select>
                  <select
                    value={resAccess}
                    onChange={(e) => setResAccess(e.target.value as 'free' | 'paid')}
                    className="px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                  >
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                {resAccess === 'paid' && (
                  <input
                    type="number"
                    min={5000}
                    step={1000}
                    value={resPrice}
                    onChange={(e) => setResPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg bg-white/80"
                  />
                )}
                {resError && <p role="alert" className="text-xs font-medium text-red-700">{resError}</p>}
                <button
                  type="submit"
                  disabled={savingResource}
                  className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                  {savingResource ? 'Saving resource…' : editingResourceId ? 'Save Resource Changes' : 'Publish Resource'}
                </button>
                {editingResourceId && (
                  <button
                    type="button"
                    onClick={resetResourceForm}
                    className="w-full px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel Editing
                  </button>
                )}
              </form>

              <div className="lg:col-span-8 glass-card rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/50 border-b border-slate-200/80 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Resource</th>
                      <th className="px-4 py-3 font-semibold">Division</th>
                      <th className="px-4 py-3 font-semibold">Price</th>
                      <th className="px-4 py-3 font-semibold text-right">Approval</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {state.resources.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{r.title}</p>
                          <p className="text-[11px] text-slate-500">{r.format} · {r.downloads} downloads</p>
                          {r.attachment && (
                            <p className="max-w-64 truncate text-[11px] text-[#0F4C81]" title={r.attachment.fileName}>
                              {r.attachment.fileName} · {formatFileSize(r.attachment.sizeBytes)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">{DIVISION_META[r.division].short}</td>
                        <td className="px-4 py-3 font-mono-tabular">{formatUGX(r.priceUGX)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingResourceId(r.id);
                                setResTitle(r.title);
                                setResDescription(r.description);
                                setResPreviewContent(r.previewContent);
                                setResCategory(r.category);
                                setResDivision(r.division);
                                setResAccess(r.accessType);
                                setResPrice(r.priceUGX);
                                setResFormat(r.format);
                                setResFile(null);
                                setResCurrentAttachment(r.attachment);
                                setRemoveResAttachment(false);
                                setResError('');
                                if (resourceFileInput.current) resourceFileInput.current.value = '';
                              }}
                              className="text-[#0F4C81] font-semibold hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm(`Delete "${r.title}"? This also removes learner access.`)) return;
                                const res = await api.deleteResource(r.id);
                                onStateChange(res.state);
                                if (editingResourceId === r.id) {
                                  resetResourceForm();
                                }
                              }}
                              className="text-red-700 font-semibold hover:underline"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await api.updateResource(r.id, { approved: !r.approved });
                                onStateChange(res.state);
                              }}
                              className={`px-3 py-1 text-xs font-semibold rounded ${
                                r.approved ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {r.approved ? 'Approved' : 'Approve Now'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 12. PAYMENTS */}
          {area === 'payments' && (
            <div className="glass-card rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/50 border-b border-slate-200/80 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">ID</th>
                    <th className="px-4 py-3 font-semibold">Learner</th>
                    <th className="px-4 py-3 font-semibold">Item</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 font-semibold text-right">Amount</th>
                    <th className="px-4 py-3 font-semibold text-right">Status / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {state.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3 font-mono-tabular">{tx.id}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{tx.userName}</td>
                      <td className="px-4 py-3 text-slate-700">{tx.itemTitle}</td>
                      <td className="px-4 py-3 text-slate-600">{tx.method}</td>
                      <td className="px-4 py-3 text-right font-mono-tabular font-semibold">{formatUGX(tx.amountUGX)}</td>
                      <td className="px-4 py-3 text-right">
                        {tx.status === 'completed' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await api.refundPayment(tx.id);
                              onStateChange(res.state);
                            }}
                            className="text-red-700 font-semibold hover:underline"
                          >
                            Issue Refund
                          </button>
                        ) : (
                          <span className="text-slate-500">Refunded</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 13. FINANCE */}
          {area === 'finance' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card rounded-xl p-5">
                  <p className="text-xs text-slate-500">Gross Completed Volume</p>
                  <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">{formatUGX(grossRevenue)}</p>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <p className="text-xs text-slate-500">
                    KWAN Platform Commission ({state.settings.platformCommissionPercent}%)
                  </p>
                  <p className="text-2xl font-bold font-mono-tabular text-emerald-700 mt-1">
                    {formatUGX(totalCommission)}
                  </p>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <p className="text-xs text-slate-500">Tutor Net Payout Pool</p>
                  <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">
                    {formatUGX(grossRevenue - totalCommission)}
                  </p>
                </div>
              </div>
              <div className="glass-card rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-slate-900">Division Revenue Distribution</h2>
                {(['primary', 'lower_secondary', 'upper_secondary'] as const).map((div) => {
                  const sum = completedTx.filter((t) => t.division === div).reduce((a, b) => a + b.amountUGX, 0);
                  const pct = grossRevenue ? Math.round((sum / grossRevenue) * 100) : 0;
                  return (
                    <div key={div} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span>{DIVISION_META[div].label}</span>
                        <span className="font-mono-tabular">{formatUGX(sum)} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-200/70 rounded-full overflow-hidden">
                        <div className="h-full bg-[#10B981] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 14. REPORTS */}
          {area === 'reports' && (
            <div className="glass-card rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Academic & Financial Summary Reports</h2>
                  <p className="text-xs text-slate-600">
                    Export live transaction & academic completion data across Primary, Lower Secondary, and Upper Secondary.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={exportCsvReport}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV Report
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {(['primary', 'lower_secondary', 'upper_secondary'] as const).map((div) => {
                  const subs = state.submissions.filter((s) => s.division === div && s.status === 'marked');
                  const avg = subs.length
                    ? Math.round(subs.reduce((a, b) => a + ((b.score || 0) / b.maxScore) * 100, 0) / subs.length)
                    : 0;
                  return (
                    <div key={div} className="glass-panel rounded-lg p-4 space-y-1">
                      <p className="font-bold text-slate-900">{DIVISION_META[div].label}</p>
                      <p className="text-slate-600 font-mono-tabular">Average Marked Score: {avg ? `${avg}%` : '—'}</p>
                      <p className="text-slate-600 font-mono-tabular">
                        Marked Submissions: {subs.length}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 15. SETTINGS */}
          {area === 'settings' && (
            <div className="glass-card rounded-xl p-6 max-w-2xl space-y-4">
              <h2 className="text-base font-bold text-slate-900">Platform-Wide Configuration</h2>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Platform Name</label>
                <input
                  type="text"
                  value={settingsDraft.platformName}
                  onChange={(e) => setSettingsDraft({ ...settingsDraft, platformName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Platform Commission (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={settingsDraft.platformCommissionPercent}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, platformCommissionPercent: Number(e.target.value) })
                  }
                  className="w-32 px-3 py-2 text-xs font-mono-tabular border border-slate-300 rounded-lg bg-white/80"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={settingsDraft.requireTutorApproval}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, requireTutorApproval: e.target.checked })
                    }
                  />
                  Require administrator approval before tutors manage courses
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={settingsDraft.allowStudentSelfRegistration}
                    onChange={(e) =>
                      setSettingsDraft({ ...settingsDraft, allowStudentSelfRegistration: e.target.checked })
                    }
                  />
                  Allow public Get Started student self-registration
                </label>
              </div>
              {settingsSaved && (
                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Platform settings updated.
                </p>
              )}
              <button
                type="button"
                onClick={async () => {
                  const res = await api.updateSettings(settingsDraft);
                  onStateChange(res.state);
                  setSettingsSaved(true);
                  setTimeout(() => setSettingsSaved(false), 3000);
                }}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                Save Platform Settings
              </button>
            </div>
          )}
        </main>

        <footer className="bg-[#0F4C81] border-t border-[#1D5E96] px-6 py-3 text-xs text-[#E2E8F0] flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-white">KWAN Education Platform · Central Governance</span>
          <span>All curriculum, tutor &amp; financial controls active</span>
        </footer>
      </div>

      <MarkingModal
        key={markingTarget?.id || 'admin-mark-none'}
        submission={markingTarget}
        course={state.courses.find((c) => c.id === markingTarget?.courseId)}
        markerName={user.name}
        onClose={() => setMarkingTarget(null)}
        onSaveMark={async (id, payload) => {
          const res = await api.markSubmission(id, payload);
          onStateChange(res.state);
        }}
      />
    </div>
  );
}
