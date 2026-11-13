import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Plus,
  Search,
  Send,
  UserCheck,
  X,
} from 'lucide-react';
import type { Course, DivisionId, ForumThread, PlatformState, UserAccount } from '../../types/kwan';
import { api, DIVISION_META } from '../../lib/api';

interface CourseDiscussionForumProps {
  division?: DivisionId;
  mode?: 'student' | 'tutor';
  state: PlatformState;
  user: UserAccount;
  courses: Course[];
  defaultCourseId?: string | null;
  onStateChange: (next: PlatformState) => void;
}

interface TopicOption {
  id: string;
  label: string;
  kind: 'module' | 'lesson';
}

function getCourseTopics(course: Course | undefined): TopicOption[] {
  if (!course) return [];
  const options: TopicOption[] = [];
  for (const mod of course.modules) {
    options.push({
      id: mod.id,
      label: mod.title,
      kind: 'module',
    });
    for (const lesson of mod.lessons) {
      options.push({
        id: lesson.id,
        label: `${mod.title} — ${lesson.title}`,
        kind: 'lesson',
      });
    }
  }
  return options;
}

const FORUM_THEME: Record<
  DivisionId | 'tutor',
  {
    surface: string;
    headingFont: string;
    primaryBtn: string;
    activeItem: string;
    title: string;
    subtitle: string;
  }
> = {
  primary: {
    surface: 'glass-card border-2 border-amber-200/80 rounded-2xl',
    headingFont: 'font-kids font-bold text-[#292524]',
    primaryBtn: 'bg-[#10B981] text-white hover:bg-[#059669] rounded-xl',
    activeItem: 'bg-amber-50/85 border-amber-500',
    title: 'Primary Class Q&A Forum',
    subtitle: 'Ask your teacher a question about any lesson or activity topic.',
  },
  lower_secondary: {
    surface: 'glass-card rounded-2xl',
    headingFont: 'font-bold text-slate-900',
    primaryBtn: 'bg-teal-700 text-white hover:bg-teal-800 rounded-lg',
    activeItem: 'bg-teal-50/80 border-teal-700',
    title: 'Lower Secondary Course Discussion Forum',
    subtitle: 'Post structured questions under O-Level course modules and review tutor explanations.',
  },
  upper_secondary: {
    surface: 'glass-card rounded-xl',
    headingFont: 'font-editorial font-semibold text-stone-900',
    primaryBtn: 'bg-stone-900 text-white hover:bg-stone-800 rounded-lg',
    activeItem: 'bg-stone-100/90 border-stone-900',
    title: 'Upper Secondary Seminar Discussion Forum',
    subtitle: 'Consult principal subject lecturers on derivations, practical errors, and seminar topics.',
  },
  tutor: {
    surface: 'glass-card rounded-2xl',
    headingFont: 'font-bold text-slate-900',
    primaryBtn: 'bg-slate-900 text-white hover:bg-slate-800 rounded-lg',
    activeItem: 'bg-amber-50/75 border-amber-600',
    title: 'Course Q&A & Student Questions',
    subtitle: 'Answer student questions across your authorised courses and specific curriculum topics.',
  },
};

export function CourseDiscussionForum({
  division,
  mode = 'student',
  state,
  user,
  courses,
  defaultCourseId,
  onStateChange,
}: CourseDiscussionForumProps) {
  const theme = FORUM_THEME[mode === 'tutor' ? 'tutor' : division || 'lower_secondary'];
  const isTutorOrAdmin = user.role === 'tutor' || user.role === 'admin';

  // Filters
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'answered' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer State
  const [composerOpen, setComposerOpen] = useState(false);
  const [askCourseId, setAskCourseId] = useState<string>(defaultCourseId || courses[0]?.id || '');
  const [askTopicId, setAskTopicId] = useState<string>('');
  const [askTitle, setAskTitle] = useState('');
  const [askBody, setAskBody] = useState('');
  const [askError, setAskError] = useState('');
  const [postingThread, setPostingThread] = useState(false);

  // Active Thread + Reply State
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyError, setReplyError] = useState('');
  const [postingReply, setPostingReply] = useState(false);

  const courseIdsSet = useMemo(() => new Set(courses.map((c) => c.id)), [courses]);

  const askCourse = useMemo(
    () => courses.find((c) => c.id === askCourseId) || courses[0],
    [courses, askCourseId]
  );
  const askTopicOptions = useMemo(() => getCourseTopics(askCourse), [askCourse]);

  useEffect(() => {
    if (askCourse && (!askTopicOptions.some((t) => t.id === askTopicId))) {
      setAskTopicId(askTopicOptions[0]?.id || 'general');
    }
  }, [askCourse, askTopicOptions, askTopicId]);

  const filterCourse = useMemo(
    () => (courseFilter === 'all' ? undefined : courses.find((c) => c.id === courseFilter)),
    [courses, courseFilter]
  );
  const filterTopicOptions = useMemo(() => getCourseTopics(filterCourse), [filterCourse]);

  useEffect(() => {
    if (topicFilter !== 'all' && !filterTopicOptions.some((t) => t.id === topicFilter)) {
      setTopicFilter('all');
    }
  }, [filterTopicOptions, topicFilter]);

  const visibleThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (state.forumThreads || [])
      .filter((t) => {
        if (division && mode !== 'tutor') {
          return t.division === division && courseIdsSet.has(t.courseId);
        }
        return courseIdsSet.has(t.courseId);
      })
      .filter((t) => (courseFilter === 'all' ? true : t.courseId === courseFilter))
      .filter((t) => (topicFilter === 'all' ? true : t.topicId === topicFilter))
      .filter((t) => (statusFilter === 'all' ? true : t.status === statusFilter))
      .filter((t) => {
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          t.body.toLowerCase().includes(q) ||
          t.topicTitle.toLowerCase().includes(q) ||
          t.courseTitle.toLowerCase().includes(q) ||
          t.authorName.toLowerCase().includes(q)
        );
      });
  }, [state.forumThreads, division, mode, courseIdsSet, courseFilter, topicFilter, statusFilter, searchQuery]);

  const activeThread: ForumThread | undefined = useMemo(
    () => visibleThreads.find((t) => t.id === selectedThreadId) || visibleThreads[0],
    [visibleThreads, selectedThreadId]
  );

  const openQuestionsCount = useMemo(() => {
    return (state.forumThreads || []).filter((t) => {
      const inScope =
        division && mode !== 'tutor'
          ? t.division === division && courseIdsSet.has(t.courseId)
          : courseIdsSet.has(t.courseId);
      return inScope && t.status === 'open';
    }).length;
  }, [state.forumThreads, division, mode, courseIdsSet]);

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askCourse) return;
    if (!askTitle.trim() || !askBody.trim()) {
      setAskError('Please enter both a clear question headline and details.');
      return;
    }
    setAskError('');
    setPostingThread(true);
    try {
      const topicObj = askTopicOptions.find((t) => t.id === askTopicId);
      const res = await api.createForumThread({
        courseId: askCourse.id,
        topicId: topicObj?.id || 'general',
        topicTitle: topicObj?.label || 'General Course Discussion',
        authorId: user.id,
        title: askTitle.trim(),
        body: askBody.trim(),
      });
      onStateChange(res.state);
      setSelectedThreadId(res.thread.id);
      setAskTitle('');
      setAskBody('');
      setComposerOpen(false);
    } catch (err) {
      setAskError(err instanceof Error ? err.message : 'Unable to post question');
    } finally {
      setPostingThread(false);
    }
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThread || !replyBody.trim()) return;
    setReplyError('');
    setPostingReply(true);
    try {
      const res = await api.replyForumThread(activeThread.id, {
        authorId: user.id,
        body: replyBody.trim(),
      });
      onStateChange(res.state);
      setReplyBody('');
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Unable to post reply');
    } finally {
      setPostingReply(false);
    }
  };

  const handleStatusChange = async (thread: ForumThread, nextStatus: ForumThread['status']) => {
    const res = await api.updateForumThreadStatus(thread.id, nextStatus);
    onStateChange(res.state);
  };

  const renderStatusLabel = (status: ForumThread['status']) => {
    if (status === 'resolved') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
        </span>
      );
    }
    if (status === 'answered') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
          <UserCheck className="w-3.5 h-3.5" /> Tutor Answered
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
        <Clock className="w-3.5 h-3.5" /> Awaiting Tutor Answer
      </span>
    );
  };

  return (
    <section className="space-y-6">
      {/* Forum Header & Primary Action */}
      <div className={`${theme.surface} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex items-start gap-3">
          <MessageSquare className="w-5 h-5 text-slate-800 shrink-0 mt-0.5" />
          <div>
            <h2 className={`text-lg ${theme.headingFont}`}>{theme.title}</h2>
            <p className="text-xs text-slate-600">
              {theme.subtitle} · <span className="font-mono-tabular font-semibold">{openQuestionsCount}</span> open question{openQuestionsCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={courses.length === 0}
          onClick={() => setComposerOpen((o) => !o)}
          className={`px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 ${theme.primaryBtn}`}
        >
          {composerOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {composerOpen
            ? 'Close Form'
            : mode === 'tutor'
            ? 'Start Topic Note'
            : 'Ask a Question'}
        </button>
      </div>

      {/* Ask a Question Composer */}
      {composerOpen && (
        <form onSubmit={handleCreateThread} className={`${theme.surface} p-6 space-y-4`}>
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className={`text-base ${theme.headingFont}`}>
              {mode === 'tutor' ? 'Post a Course Topic Note or Prompt' : 'Post a Question Under a Course Topic'}
            </h3>
            <span className="text-xs text-slate-500">
              Saved permanently for classmates &amp; tutors
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="forum-ask-course" className="block text-xs font-semibold text-slate-700 mb-1">
                Course / Subject
              </label>
              <select
                id="forum-ask-course"
                value={askCourse?.id || ''}
                onChange={(e) => setAskCourseId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="forum-ask-topic" className="block text-xs font-semibold text-slate-700 mb-1">
                Course Topic / Module
              </label>
              <select
                id="forum-ask-topic"
                value={askTopicId}
                onChange={(e) => setAskTopicId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                {askTopicOptions.length === 0 ? (
                  <option value="general">General Course Discussion</option>
                ) : (
                  askTopicOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="forum-ask-title" className="block text-xs font-semibold text-slate-700 mb-1">
              Question Headline
            </label>
            <input
              id="forum-ask-title"
              type="text"
              required
              value={askTitle}
              onChange={(e) => setAskTitle(e.target.value)}
              placeholder={
                division === 'primary'
                  ? 'e.g. How do we compare 2/3 and 3/4 using fraction strips?'
                  : 'e.g. How do I choose signs when substituting into Equation (2)?'
              }
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="forum-ask-body" className="block text-xs font-semibold text-slate-700 mb-1">
              Question Details &amp; What You Tried
            </label>
            <textarea
              id="forum-ask-body"
              rows={3}
              required
              value={askBody}
              onChange={(e) => setAskBody(e.target.value)}
              placeholder="Explain where you got stuck or paste the step you want your tutor to check..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900"
            />
          </div>

          {askError && (
            <p className="text-xs text-red-700 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" /> {askError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={postingThread}
              className={`px-5 py-2 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 ${theme.primaryBtn}`}
            >
              <Send className="w-3.5 h-3.5" />
              {postingThread ? 'Posting...' : 'Post Question to Topic'}
            </button>
          </div>
        </form>
      )}

      {/* Course, Topic, Status & Search Filters */}
      <div className={`${theme.surface} p-4 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions or topics..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
            />
          </div>

          <select
            aria-label="Filter by course"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 max-w-[220px]"
          >
            <option value="all">All Subjects ({courses.length})</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.subject} ({c.code})
              </option>
            ))}
          </select>

          {filterCourse && filterTopicOptions.length > 0 && (
            <select
              aria-label="Filter by topic"
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 max-w-[240px]"
            >
              <option value="all">All Course Topics</option>
              {filterTopicOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'open', label: 'Needs Answer' },
              { id: 'answered', label: 'Answered' },
              { id: 'resolved', label: 'Resolved' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Master-Detail Discussion Split */}
      {visibleThreads.length === 0 ? (
        <div className={`${theme.surface} p-10 text-center space-y-3`}>
          <p className="text-sm font-semibold text-slate-800">
            No questions match your current topic or status filter.
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Select a different filter or ask a new question under any course topic to start a discussion with your tutor.
          </p>
          {courses.length > 0 && (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className={`px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 ${theme.primaryBtn}`}
            >
              <Plus className="w-3.5 h-3.5" /> Ask a Topic Question
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Topic Question List */}
          <div className="lg:col-span-5 space-y-2.5">
            {visibleThreads.map((thread) => {
              const selected = activeThread?.id === thread.id;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={`w-full text-left p-4 border rounded-xl transition-colors space-y-2 backdrop-blur-md ${
                    selected
                      ? theme.activeItem
                      : 'bg-white/60 border-white/80 hover:bg-white/85'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="truncate font-medium text-slate-700">
                      {DIVISION_META[thread.division].short} · {thread.topicTitle}
                    </span>
                    <span className="font-mono-tabular shrink-0">
                      {thread.replies.length} repl{thread.replies.length === 1 ? 'y' : 'ies'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{thread.title}</h3>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-500">
                      {thread.authorName}
                      {thread.authorClassLevel ? ` (${thread.authorClassLevel})` : ''} ·{' '}
                      <span className="font-mono-tabular">{thread.createdAt}</span>
                    </span>
                    {renderStatusLabel(thread.status)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Active Question & Tutor Answers */}
          {activeThread && (
            <div className={`lg:col-span-7 ${theme.surface} p-6 space-y-6`}>
              <div className="space-y-3 pb-5 border-b border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-slate-800">{activeThread.courseTitle}</span>
                    <span aria-hidden="true">·</span>
                    <span>Topic: {activeThread.topicTitle}</span>
                  </div>
                  {renderStatusLabel(activeThread.status)}
                </div>

                <h3 className={`text-xl ${theme.headingFont}`}>{activeThread.title}</h3>

                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                  {activeThread.body}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500">
                  <span>
                    Asked by <strong className="text-slate-800">{activeThread.authorName}</strong>
                    {activeThread.authorClassLevel ? ` (${activeThread.authorClassLevel})` : ''} ·{' '}
                    <span className="font-mono-tabular">{activeThread.createdAt}</span>
                  </span>

                  {(user.id === activeThread.authorId || isTutorOrAdmin) && (
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusChange(
                          activeThread,
                          activeThread.status === 'resolved'
                            ? activeThread.replies.some((r) => r.isOfficialAnswer)
                              ? 'answered'
                              : 'open'
                            : 'resolved'
                        )
                      }
                      className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      {activeThread.status === 'resolved' ? 'Reopen Question' : 'Mark Resolved'}
                    </button>
                  )}
                </div>
              </div>

              {/* Replies List */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-slate-600">
                  Answers &amp; Discussion ({activeThread.replies.length})
                </h4>

                {activeThread.replies.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
                    {isTutorOrAdmin
                      ? 'No answers posted yet. Write an official tutor explanation below to guide this learner.'
                      : 'Awaiting a tutor response. Classmates or your subject tutor can reply below.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeThread.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className={`rounded-xl p-4 border space-y-2 ${
                          reply.isOfficialAnswer
                            ? 'bg-emerald-50/70 border-emerald-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{reply.authorName}</span>
                            <span aria-hidden="true" className="text-slate-400">
                              ·
                            </span>
                            {reply.isOfficialAnswer ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                                <UserCheck className="w-3.5 h-3.5" />
                                Verified Tutor Answer
                                {reply.authorClassOrTitle ? ` (${reply.authorClassOrTitle})` : ''}
                              </span>
                            ) : (
                              <span className="text-slate-600">
                                {reply.authorClassOrTitle || 'Student'}
                              </span>
                            )}
                          </div>
                          <span className="font-mono-tabular text-slate-500">{reply.createdAt}</span>
                        </div>
                        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                          {reply.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply Form */}
              <form onSubmit={handlePostReply} className="pt-4 border-t border-slate-200 space-y-3">
                <label htmlFor="forum-reply-input" className="block text-xs font-semibold text-slate-700">
                  {isTutorOrAdmin
                    ? 'Provide Official Tutor Answer'
                    : 'Add Follow-up Question or Peer Reply'}
                </label>
                <textarea
                  id="forum-reply-input"
                  rows={3}
                  required
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={
                    isTutorOrAdmin
                      ? 'Write a clear step-by-step explanation for the learner and class...'
                      : 'Write a follow-up question or share how you solved it...'
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900"
                />
                {replyError && (
                  <p className="text-xs text-red-700 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {replyError}
                  </p>
                )}
                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={postingReply || !replyBody.trim()}
                    className={`px-4 py-2 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 ${theme.primaryBtn}`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {postingReply
                      ? 'Posting...'
                      : isTutorOrAdmin
                      ? 'Post Tutor Answer'
                      : 'Post Reply'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
