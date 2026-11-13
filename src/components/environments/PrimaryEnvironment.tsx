import { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Eye,
  LogOut,
  PlayCircle,
  Send,
  Sparkles,
  Star,
  UserCheck,
} from 'lucide-react';
import type { Course, PlatformState, UserAccount } from '../../types/kwan';
import { api, formatUGX } from '../../lib/api';
import { SafeImage } from '../shared/SafeImage';
import { FractionExplorer } from '../shared/InteractiveLabs';
import { PaymentCheckoutModal } from '../shared/PaymentCheckoutModal';
import { StudentProgressDashboard, type LocalPracticeScore } from '../shared/StudentProgressDashboard';
import { CourseDiscussionForum } from '../shared/CourseDiscussionForum';

interface PrimaryEnvironmentProps {
  state: PlatformState;
  user: UserAccount;
  onStateChange: (next: PlatformState, updatedUser?: UserAccount) => void;
  onLogout: () => void;
  isAdminPreview?: boolean;
}

export function PrimaryEnvironment({
  state,
  user,
  onStateChange,
  onLogout,
  isAdminPreview = false,
}: PrimaryEnvironmentProps) {
  const [parentView, setParentView] = useState(false);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [quizSelections, setQuizSelections] = useState<Record<string, number>>({});
  const [quizChecked, setQuizChecked] = useState<Record<string, boolean>>({});
  const [assignmentAnswer, setAssignmentAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutCourse, setCheckoutCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<'learn' | 'progress' | 'forum' | 'rewards'>('learn');
  const [practiceScores, setPracticeScores] = useState<Record<string, LocalPracticeScore>>({});

  const classLevel = user.classLevel || 'P.5';
  const eligibleCourses = state.courses.filter(
    (c) => c.status === 'published' && c.division === 'primary' && c.allowedClasses.includes(classLevel)
  );
  const activeCourse = eligibleCourses.find((c) => c.id === activeCourseId) || eligibleCourses[0];
  const allLessons = activeCourse ? activeCourse.modules.flatMap((m) => m.lessons) : [];
  const activeLesson = allLessons.find((l) => l.id === activeLessonId) || allLessons[0];

  const mySubmissions = state.submissions.filter((s) => s.studentId === user.id && s.division === 'primary');

  const completedCount = allLessons.filter((l) => user.completedLessonIds.includes(l.id)).length;
  const progressPercent = allLessons.length ? Math.round((completedCount / allLessons.length) * 100) : 0;

  const handleCompleteLesson = async (lessonId: string) => {
    const res = await api.completeLesson(user.id, lessonId);
    onStateChange(res.state, res.user);
  };

  const handleSubmitAssignment = async (assessmentId: string) => {
    if (!activeCourse || !assignmentAnswer.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.submitWork({
        studentId: user.id,
        courseId: activeCourse.id,
        assessmentId,
        answerText: assignmentAnswer.trim(),
      });
      setAssignmentAnswer('');
      const refreshedUser = res.state.users.find((u) => u.id === user.id) || user;
      onStateChange(res.state, refreshedUser);
    } finally {
      setSubmitting(false);
    }
  };

  const isEnrolled = (course: Course) =>
    course.accessType === 'free' || user.enrolledCourseIds.includes(course.id);

  return (
    <div className="min-h-screen flex flex-col bg-kid-pattern text-[#292524]">
      {/* Friendly Light-Blue Glass Primary Header */}
      <header className="glass-header-footer border-b border-sky-200/80 px-6 py-4 sticky top-0 z-20 text-slate-900">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-sky-200/90 border border-sky-300 text-slate-950 font-kids font-extrabold flex items-center justify-center text-xl shadow-sm">
              K
            </div>
            <div>
              <h1 className="font-kids text-xl font-bold text-slate-950">
                KWAN Primary Learning Space · {classLevel}
              </h1>
              <p className="text-xs font-medium text-slate-700">
                Welcome, <strong className="text-slate-950">{user.name}</strong> ·{' '}
                <span className="font-mono-tabular font-semibold text-amber-800">{user.stars} Learning Stars</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-white/65 backdrop-blur-md border border-sky-200 rounded-2xl p-1">
              <button
                type="button"
                onClick={() => setActiveTab('learn')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                  activeTab === 'learn'
                    ? 'bg-amber-400 text-[#292524] shadow-sm'
                    : 'text-slate-700 hover:bg-white/80'
                }`}
              >
                My Subjects
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('progress')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                  activeTab === 'progress'
                    ? 'bg-amber-400 text-[#292524] shadow-sm'
                    : 'text-slate-700 hover:bg-white/80'
                }`}
              >
                My Progress
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('forum')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                  activeTab === 'forum'
                    ? 'bg-amber-400 text-[#292524] shadow-sm'
                    : 'text-slate-700 hover:bg-white/80'
                }`}
              >
                Class Q&amp;A Forum
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('rewards')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                  activeTab === 'rewards'
                    ? 'bg-amber-400 text-[#292524] shadow-sm'
                    : 'text-slate-700 hover:bg-white/80'
                }`}
              >
                Stars &amp; Feedback
              </button>
            </div>

            <button
              type="button"
              onClick={() => setParentView((p) => !p)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl border flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                parentView
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white/75 text-slate-900 border-sky-300/80 hover:bg-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {parentView ? 'Exit Parent View' : 'Parent / Guardian View'}
            </button>

            {!isAdminPreview && (
              <button
                type="button"
                onClick={onLogout}
                className="px-3.5 py-2 text-xs font-bold text-slate-900 bg-white/75 border border-sky-300/80 rounded-xl hover:bg-white flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Optional Parent / Guardian Summary Banner */}
        {parentView && (
          <section className="glass-card border-2 border-amber-300/80 rounded-2xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <UserCheck className="w-6 h-6 text-emerald-700" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Parent & Guardian Progress Snapshot
                  </h2>
                  <p className="text-xs text-slate-600">
                    Guardian: {user.guardianName || 'Registered Parent'} · Contact: {user.guardianContact || 'On file'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-amber-900 bg-amber-50/90 border border-amber-200 rounded-lg px-3 py-1.5">
                Class: {classLevel} · Active Learner
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-panel rounded-xl p-4">
                <p className="text-xs text-slate-500">Lessons Completed</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                  {user.completedLessonIds.length} lessons
                </p>
              </div>
              <div className="glass-panel rounded-xl p-4">
                <p className="text-xs text-slate-500">Marked Assignments</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                  {mySubmissions.filter((s) => s.status === 'marked').length} reviewed
                </p>
              </div>
              <div className="glass-panel rounded-xl p-4">
                <p className="text-xs text-slate-500">Latest Teacher Comment</p>
                <p className="text-sm font-medium text-slate-800 mt-1">
                  {mySubmissions[0]?.tutorFeedback || 'Making steady progress in Mathematics and Science.'}
                </p>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'learn' && (
          <>
            {/* Large Primary Subject Cards */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-kids text-2xl font-bold text-[#292524]">Your {classLevel} Subject Cards</h2>
                <span className="text-xs font-semibold text-slate-600">
                  {eligibleCourses.length} approved Primary subjects for {classLevel}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {eligibleCourses.map((course) => {
                  const selected = activeCourse?.id === course.id;
                  const unlocked = isEnrolled(course);
                  return (
                    <div
                      key={course.id}
                      className={`glass-card rounded-2xl border-2 overflow-hidden transition-all shadow-kid ${
                        selected ? 'border-amber-500 -translate-y-0.5' : 'border-amber-200/80 hover:border-amber-400'
                      }`}
                    >
                      <SafeImage src={course.thumbnailUrl} alt={course.title} className="w-full h-36 object-cover" />
                      <div className="p-5">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
                          <span className="text-amber-800">{course.subject}</span>
                          <span className="font-mono-tabular">{course.allowedClasses.join(', ')}</span>
                        </div>
                        <h3 className="font-kids text-lg font-bold text-[#292524] mb-2">{course.title}</h3>
                        <p className="text-xs text-slate-600 line-clamp-2 mb-4">{course.summary}</p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-emerald-700 font-mono-tabular">
                            {unlocked ? 'Ready to Learn' : formatUGX(course.priceUGX)}
                          </span>
                          {unlocked ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveCourseId(course.id);
                                setActiveLessonId(course.modules[0]?.lessons[0]?.id || null);
                              }}
                              className="px-4 py-2 text-xs font-bold text-[#292524] bg-amber-400 rounded-xl hover:bg-amber-300 whitespace-nowrap"
                            >
                              Open Subject
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCheckoutCourse(course)}
                              className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 rounded-xl hover:bg-emerald-800 whitespace-nowrap"
                            >
                              Enrol Now
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Active Primary Lesson & Practice Journey */}
            {activeCourse && isEnrolled(activeCourse) && activeLesson && (
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Lesson List + Progress */}
                <div className="lg:col-span-4 glass-card border-2 border-amber-200/80 rounded-2xl p-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-amber-800">{activeCourse.subject}</p>
                    <h3 className="text-lg font-bold text-slate-900">{activeCourse.title}</h3>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                        <span>Progress</span>
                        <span className="tabular-nums">{progressPercent}%</span>
                      </div>
                      <div className="h-3 bg-amber-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {allLessons.map((lesson, idx) => {
                      const done = user.completedLessonIds.includes(lesson.id);
                      const isCurrent = lesson.id === activeLesson.id;
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => setActiveLessonId(lesson.id)}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-colors flex items-start gap-3 ${
                            isCurrent
                              ? 'bg-amber-50 border-amber-400'
                              : 'bg-white border-slate-100 hover:border-amber-200'
                          }`}
                        >
                          <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900">{lesson.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {lesson.durationMinutes} min · {done ? 'Completed' : 'Ready'}
                            </p>
                          </div>
                          {done && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Illustrated Lesson Stage */}
                <div className="lg:col-span-8 glass-card border-2 border-amber-200/80 rounded-2xl p-6 space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-amber-100 pb-4">
                    <div>
                      <p className="text-xs font-semibold text-amber-800">
                        Step-by-Step Lesson · {activeLesson.durationMinutes} minutes
                      </p>
                      <h3 className="text-2xl font-bold text-slate-900 mt-1">{activeLesson.title}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCompleteLesson(activeLesson.id)}
                      className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 whitespace-nowrap ${
                        user.completedLessonIds.includes(activeLesson.id)
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {user.completedLessonIds.includes(activeLesson.id) ? 'Lesson Completed (+2 Stars)' : 'Mark Complete (+2 Stars)'}
                    </button>
                  </div>

                  {activeLesson.videoTranscript && (
                    <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
                      <PlayCircle className="w-9 h-9 text-amber-600 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">Short Video Storyboard</p>
                        <p className="text-sm text-slate-700 mt-1 leading-relaxed">{activeLesson.videoTranscript}</p>
                      </div>
                    </div>
                  )}

                  <div className="text-base text-slate-800 leading-relaxed bg-amber-50/40 border border-amber-100 rounded-2xl p-5">
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-900 mb-2">
                      <BookOpen className="w-4 h-4" /> Reading & Illustrated Note
                    </div>
                    <p>{activeLesson.content}</p>
                  </div>

                  {activeLesson.interactiveKind === 'fractions' && <FractionExplorer />}

                  {/* Practice Questions */}
                  {activeLesson.practiceQuestions && activeLesson.practiceQuestions.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-lg font-bold text-slate-900">Practice Questions</h4>
                      {activeLesson.practiceQuestions.map((q) => {
                        const chosen = quizSelections[q.id];
                        const isChecked = quizChecked[q.id];
                        const correct = chosen === q.correctIndex;
                        return (
                          <div key={q.id} className="border-2 border-slate-100 rounded-2xl p-4 space-y-3">
                            <p className="text-sm font-bold text-slate-900">{q.prompt}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map((opt, idx) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => {
                                    const nextSelections = { ...quizSelections, [q.id]: idx };
                                    setQuizSelections(nextSelections);
                                    setQuizChecked((prev) => ({ ...prev, [q.id]: true }));
                                    if (activeCourse && activeLesson?.practiceQuestions?.length) {
                                      const correctTotal = activeLesson.practiceQuestions.filter(
                                        (pq) => nextSelections[pq.id] === pq.correctIndex
                                      ).length;
                                      setPracticeScores((prev) => ({
                                        ...prev,
                                        [activeLesson.id]: {
                                          id: `pq-${activeLesson.id}`,
                                          courseId: activeCourse.id,
                                          courseTitle: activeCourse.title,
                                          subject: activeCourse.subject,
                                          title: `${activeLesson.title} Quiz`,
                                          score: correctTotal,
                                          maxScore: activeLesson.practiceQuestions!.length,
                                          dateLabel: new Date().toISOString().slice(0, 16).replace('T', ' '),
                                        },
                                      }));
                                    }
                                  }}
                                  className={`px-4 py-2.5 text-sm font-semibold rounded-xl border-2 text-left transition-colors ${
                                    chosen === idx
                                      ? isChecked && correct
                                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                                        : 'bg-amber-50 border-amber-500 text-amber-950'
                                      : 'bg-white border-slate-200 hover:border-amber-400'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                            {isChecked && (
                              <p className={`text-xs font-semibold ${correct ? 'text-emerald-700' : 'text-amber-800'}`}>
                                {correct ? 'Well done! ' : 'Try checking again: '}
                                {q.explanation}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Simple Assignment Box */}
                  {activeCourse.assessments[0] && (
                    <div className="border-t-2 border-amber-100 pt-5 space-y-3">
                      <h4 className="text-lg font-bold text-slate-900">
                        Simple Activity Assignment: {activeCourse.assessments[0].title}
                      </h4>
                      <p className="text-sm text-slate-700">{activeCourse.assessments[0].instructions}</p>
                      <textarea
                        rows={3}
                        value={assignmentAnswer}
                        onChange={(e) => setAssignmentAnswer(e.target.value)}
                        placeholder="Write your answer clearly here..."
                        className="w-full px-4 py-3 text-sm border-2 border-amber-200 rounded-xl bg-white/90 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        disabled={submitting || !assignmentAnswer.trim()}
                        onClick={() => handleSubmitAssignment(activeCourse.assessments[0].id)}
                        className="px-5 py-2.5 text-sm font-bold text-[#1b1104] bg-[#f28c28] rounded-xl hover:opacity-95 disabled:opacity-50 flex items-center gap-2 shadow-glow"
                      >
                        <Send className="w-4 h-4" />
                        {submitting ? 'Sending...' : 'Send to Teacher (+3 Stars)'}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === 'progress' && (
          <StudentProgressDashboard
            division="primary"
            user={user}
            courses={eligibleCourses}
            submissions={mySubmissions}
            localPracticeScores={Object.values(practiceScores)}
            onGoToCourses={() => setActiveTab('learn')}
          />
        )}

        {activeTab === 'forum' && (
          <CourseDiscussionForum
            division="primary"
            state={state}
            user={user}
            courses={eligibleCourses}
            defaultCourseId={activeCourse?.id}
            onStateChange={(next) => onStateChange(next)}
          />
        )}

        {activeTab === 'rewards' && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 glass-card border-2 border-amber-200/80 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center">
                  <Star className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Stars & Achievements</h2>
                  <p className="text-xs text-slate-600">{user.stars} total learning stars earned</p>
                </div>
              </div>
              <div className="space-y-2 pt-2">
                {user.badges.map((badge) => (
                  <div
                    key={badge}
                    className="flex items-center gap-3 bg-amber-50/90 border border-amber-200 rounded-xl px-4 py-3"
                  >
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-bold text-slate-900">{badge}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 glass-card border-2 border-amber-200/80 rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Teacher Feedback on Your Work</h2>
              {mySubmissions.length === 0 ? (
                <p className="text-sm text-slate-600">Send an assignment from any subject to receive teacher praise and tips.</p>
              ) : (
                mySubmissions.map((sub) => (
                  <div key={sub.id} className="glass-panel border border-amber-200 rounded-xl p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">{sub.assessmentTitle}</p>
                      <span className="text-xs font-bold text-emerald-700 tabular-nums">
                        {sub.status === 'marked' ? `Score: ${sub.score}/${sub.maxScore}` : 'Waiting for Teacher'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">Your answer: {sub.answerText}</p>
                    {sub.tutorFeedback && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-950">
                        <span className="font-bold">Teacher Note: </span>
                        {sub.tutorFeedback}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        )}

      </main>

      {/* Light-Blue Glassmorphism Footer */}
      <footer className="glass-header-footer border-t border-sky-200/80 px-6 py-5 text-xs text-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-slate-950">KWAN Primary Learning Space · {classLevel}</span>
          <span>Parent &amp; Guardian Progress Supported</span>
        </div>
      </footer>

      <PaymentCheckoutModal
        open={Boolean(checkoutCourse)}
        title={checkoutCourse?.title || ''}
        subtitle={`${checkoutCourse?.subject || ''} · Primary (${checkoutCourse?.allowedClasses.join(', ')})`}
        amountUGX={checkoutCourse?.priceUGX || 0}
        onClose={() => setCheckoutCourse(null)}
        onConfirm={async (method) => {
          if (!checkoutCourse) return;
          const res = await api.purchaseItem({
            userId: user.id,
            itemType: 'course',
            itemId: checkoutCourse.id,
            method,
          });
          onStateChange(res.state, res.user);
        }}
      />
    </div>
  );
}
