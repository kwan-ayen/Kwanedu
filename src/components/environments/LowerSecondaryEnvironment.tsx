import { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  LogOut,
  Play,
  Send,
} from 'lucide-react';
import type { Course, PlatformState, UserAccount } from '../../types/kwan';
import { api, formatUGX } from '../../lib/api';
import { OsmosisCellExplorer } from '../shared/InteractiveLabs';
import { PaymentCheckoutModal } from '../shared/PaymentCheckoutModal';
import { StudentProgressDashboard } from '../shared/StudentProgressDashboard';
import { CourseDiscussionForum } from '../shared/CourseDiscussionForum';
import { StudentResourceLibrary } from '../shared/StudentResourceLibrary';

interface LowerSecondaryEnvironmentProps {
  state: PlatformState;
  user: UserAccount;
  onStateChange: (next: PlatformState, updatedUser?: UserAccount) => void;
  onLogout: () => void;
  isAdminPreview?: boolean;
}

export function LowerSecondaryEnvironment({
  state,
  user,
  onStateChange,
  onLogout,
  isAdminPreview = false,
}: LowerSecondaryEnvironmentProps) {
  const [section, setSection] = useState<'courses' | 'marking' | 'analytics' | 'forum' | 'resources'>('courses');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [homeworkText, setHomeworkText] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [notePreview, setNotePreview] = useState<string | null>(null);
  const [checkoutCourse, setCheckoutCourse] = useState<Course | null>(null);

  const classLevel = user.classLevel || 'S.3';
  const courses = state.courses.filter(
    (c) => c.status === 'published' && c.division === 'lower_secondary' && c.allowedClasses.includes(classLevel)
  );
  const activeCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];
  const lessons = activeCourse ? activeCourse.modules.flatMap((m) => m.lessons) : [];
  const activeLesson = lessons.find((l) => l.id === selectedLessonId) || lessons[0];

  const mySubmissions = state.submissions.filter(
    (s) => s.studentId === user.id && s.division === 'lower_secondary'
  );

  const isEnrolled = (course: Course) =>
    course.accessType === 'free' || user.enrolledCourseIds.includes(course.id);

  const handleSubmitHomework = async (assessmentId: string) => {
    if (!activeCourse || !homeworkText.trim()) return;
    const res = await api.submitWork({
      studentId: user.id,
      courseId: activeCourse.id,
      assessmentId,
      answerText: homeworkText.trim(),
      attachmentName: attachmentName.trim() || `${user.name.replace(/\s+/g, '_')}_${classLevel}.pdf`,
    });
    setHomeworkText('');
    setAttachmentName('');
    onStateChange(res.state, res.state.users.find((u) => u.id === user.id));
  };

  const handleCompleteLesson = async (lessonId: string) => {
    const res = await api.completeLesson(user.id, lessonId);
    onStateChange(res.state, res.user);
  };

  const handleGradeQuiz = async (assessmentId: string) => {
    setQuizSubmitted(true);
    if (!activeCourse) return;
    const ass = activeCourse.assessments.find((a) => a.id === assessmentId);
    if (!ass?.questions?.length) return;
    const correctCount = ass.questions.filter((q) => quizAnswers[q.id] === q.correctIndex).length;
    const computedScore = Math.round((correctCount / ass.questions.length) * ass.maxScore);
    const res = await api.submitWork({
      studentId: user.id,
      courseId: activeCourse.id,
      assessmentId: ass.id,
      answerText: `Completed module quiz: ${correctCount} / ${ass.questions.length} correct answers.`,
      status: 'marked',
      score: computedScore,
      tutorFeedback: `Auto-graded module quiz (${correctCount}/${ass.questions.length} correct).`,
    });
    onStateChange(res.state, res.state.users.find((u) => u.id === user.id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-animated-canvas text-slate-900">
      <header className="glass-header-footer text-white border-b border-[#1D5E96] px-6 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/kwan-mark.svg" alt="" aria-hidden="true" className="w-10 h-10 rounded-xl shadow-sm" />
            <div>
              <p className="text-xs font-semibold text-[#34D399]">
                KWAN Lower Secondary · Ugandan Curriculum ({classLevel})
              </p>
              <h1 className="text-lg font-bold text-white">
                {user.name} — Structured Study Workspace
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'courses', label: 'Subject Catalogue' },
                { id: 'marking', label: 'Red & Green Pen Marking' },
                { id: 'analytics', label: 'Performance Analytics' },
                { id: 'forum', label: 'Course Q&A Forum' },
                { id: 'resources', label: 'Study Resources' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                  section === tab.id
                    ? 'bg-[#34D399] text-[#0A2540] shadow-soft'
                    : 'bg-white/10 text-[#E2E8F0] hover:bg-white/20 hover:text-white border border-white/25'
                }`}
              >
                {tab.label}
              </button>
            ))}
            {!isAdminPreview && (
              <button
                type="button"
                onClick={onLogout}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-white/10 border border-white/30 rounded-lg hover:bg-white/20 flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {section === 'courses' && (
          <>
            {/* Course Catalogue */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {courses.map((course) => {
                const unlocked = isEnrolled(course);
                const selected = activeCourse?.id === course.id;
                const courseLessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
                const doneCount = courseLessonIds.filter((id) => user.completedLessonIds.includes(id)).length;
                const pct = courseLessonIds.length ? Math.round((doneCount / courseLessonIds.length) * 100) : 0;

                return (
                  <div
                    key={course.id}
                    className={`glass-card rounded-2xl p-5 transition-all ${
                      selected ? 'ring-2 ring-teal-700/35 border-teal-700' : 'hover:shadow-lift hover:bg-white/80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-mono-tabular text-slate-500">
                          {course.code} · {course.allowedClasses.join(', ')}
                        </p>
                        <h2 className="text-base font-bold text-slate-950 mt-1">{course.title}</h2>
                        <p className="text-xs text-slate-600 mt-1">Tutor: {course.tutorName}</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-800 tabular-nums whitespace-nowrap">
                        {unlocked ? `${pct}% Done` : formatUGX(course.priceUGX)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-3">{course.summary}</p>
                    <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-500">
                        {course.modules.length} modules · {course.assessments.length} assessments
                      </span>
                      {unlocked ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCourseId(course.id);
                            setSelectedLessonId(course.modules[0]?.lessons[0]?.id || null);
                          }}
                          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
                        >
                          Enter Course
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCheckoutCourse(course)}
                          className="px-4 py-2 text-xs font-bold text-white bg-[#10B981] rounded-lg hover:bg-[#059669] whitespace-nowrap"
                        >
                          Purchase Access
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Structured Course Workspace */}
            {activeCourse && isEnrolled(activeCourse) && activeLesson && (
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <aside className="lg:col-span-4 glass-card rounded-2xl p-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-teal-800">Structured Modules</p>
                    <h3 className="text-base font-bold text-slate-950 mt-0.5">{activeCourse.title}</h3>
                  </div>

                  {activeCourse.modules.map((mod) => (
                    <div key={mod.id} className="space-y-2">
                      <p className="text-xs font-bold text-slate-700">{mod.title}</p>
                      {mod.lessons.map((lesson) => {
                        const isDone = user.completedLessonIds.includes(lesson.id);
                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            onClick={() => setSelectedLessonId(lesson.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs transition-colors flex items-center justify-between gap-2 ${
                              activeLesson.id === lesson.id
                                ? 'bg-teal-50/90 border-teal-700 text-teal-950 font-semibold'
                                : 'bg-white/80 border-slate-200/80 text-slate-700 hover:bg-white'
                            }`}
                          >
                            <span className="truncate">{lesson.title}</span>
                            {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </aside>

                <div className="lg:col-span-8 glass-card rounded-2xl p-6 space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                      <p className="text-xs font-mono-tabular text-slate-500">
                        {activeLesson.type.toUpperCase()} · {activeLesson.durationMinutes} MIN
                      </p>
                      <h3 className="text-xl font-bold text-slate-900 mt-1">{activeLesson.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeLesson.downloadableNoteTitle && (
                        <button
                          type="button"
                          onClick={() => setNotePreview(activeLesson.downloadableNoteTitle || null)}
                          className="px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" /> Download Notes
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCompleteLesson(activeLesson.id)}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 whitespace-nowrap"
                      >
                        {user.completedLessonIds.includes(activeLesson.id) ? 'Completed' : 'Mark Complete'}
                      </button>
                    </div>
                  </div>

                  {notePreview && (
                    <div className="bg-teal-50/90 border border-teal-200 rounded-lg p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-xs text-teal-950">
                        <FileText className="w-4 h-4 text-teal-700" />
                        <span>
                          Prepared study packet <strong>{notePreview}</strong> — ready for offline UCE revision.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotePreview(null)}
                        className="text-xs font-semibold text-teal-800 hover:underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {activeLesson.videoTranscript && (
                    <div className="bg-stone-900 text-stone-100 rounded-xl p-5 flex items-start gap-4">
                      <Play className="w-7 h-7 text-[#10B981] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-[#10B981]">Video Lecture Summary</p>
                        <p className="text-sm mt-1 leading-relaxed">{activeLesson.videoTranscript}</p>
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-slate-700 leading-relaxed space-y-2">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-teal-700" /> Structured Lesson Notes
                    </h4>
                    <p>{activeLesson.content}</p>
                  </div>

                  {activeLesson.interactiveKind === 'science_cell' && <OsmosisCellExplorer />}

                  {/* Quizzes & Digital Homework Submission */}
                  <div className="border-t border-slate-200 pt-5 space-y-6">
                    {activeCourse.assessments.map((ass) => (
                      <div key={ass.id} className="glass-panel rounded-xl p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-amber-800">
                              {ass.type === 'quiz' ? 'Timed Module Quiz' : 'Digital Assignment Submission'}
                            </p>
                            <h4 className="text-base font-bold text-slate-900">{ass.title}</h4>
                          </div>
                          <span className="text-xs font-mono-tabular text-slate-600">
                            Max: {ass.maxScore} marks · Pass: {ass.minPassScore}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{ass.instructions}</p>

                        {ass.questions && ass.questions.length > 0 ? (
                          <div className="space-y-4">
                            {ass.questions.map((q) => (
                              <div key={q.id} className="space-y-2">
                                <p className="text-sm font-semibold text-slate-900">{q.prompt}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {q.options.map((opt, idx) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setQuizAnswers((p) => ({ ...p, [q.id]: idx }))}
                                      className={`px-3 py-2 text-xs font-medium rounded-lg border text-left ${
                                        quizAnswers[q.id] === idx
                                          ? 'bg-amber-50 border-amber-600 text-amber-950'
                                          : 'bg-white/85 border-slate-200 hover:bg-white'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                                {quizSubmitted && (
                                  <p
                                    className={`text-xs font-medium ${
                                      quizAnswers[q.id] === q.correctIndex ? 'text-emerald-700' : 'text-red-700'
                                    }`}
                                  >
                                    {quizAnswers[q.id] === q.correctIndex ? 'Correct: ' : 'Correction: '}
                                    {q.explanation}
                                  </p>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleGradeQuiz(ass.id)}
                              className="px-4 py-2 text-xs font-bold text-white bg-[#10B981] rounded-lg hover:bg-[#059669] shadow-soft"
                            >
                              Check &amp; Save Quiz Score
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <textarea
                              rows={3}
                              value={homeworkText}
                              onChange={(e) => setHomeworkText(e.target.value)}
                              placeholder="Enter your structured working steps and final answer..."
                              className="w-full px-3 py-2 text-sm border border-slate-300/80 bg-white/85 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <input
                                type="text"
                                value={attachmentName}
                                onChange={(e) => setAttachmentName(e.target.value)}
                                placeholder="Optional scanned sheet filename (e.g. Working.pdf)"
                                className="flex-1 min-w-[220px] px-3 py-2 text-xs border border-slate-300 rounded-lg"
                              />
                              <button
                                type="button"
                                disabled={!homeworkText.trim()}
                                onClick={() => handleSubmitHomework(ass.id)}
                                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                              >
                                <Send className="w-3.5 h-3.5" /> Submit for Marking
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {section === 'marking' && (
          <section className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Red & Green Pen Tutor Marking</h2>
              <p className="text-xs text-slate-600">
                Green pen highlights accurate methods to repeat; Red pen marks exact errors or missing steps to fix before UCE exams.
              </p>
            </div>
            {mySubmissions.map((sub) => (
              <div key={sub.id} className="glass-card rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-200">
                  <div>
                    <p className="text-xs text-slate-500">{sub.courseTitle}</p>
                    <h3 className="text-base font-bold text-slate-900">{sub.assessmentTitle}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono-tabular text-slate-900">
                      {sub.status === 'marked' ? `${sub.score} / ${sub.maxScore}` : 'Pending Tutor Marking'}
                    </span>
                    <p className="text-xs text-slate-500">Submitted {sub.submittedAt}</p>
                  </div>
                </div>

                <div className="glass-panel rounded-lg p-3 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">Submitted Solution: </span>
                  {sub.answerText}
                </div>

                {sub.status === 'marked' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-emerald-50/90 border border-emerald-200 rounded-lg p-4 space-y-1.5">
                      <p className="text-xs font-bold text-emerald-900">Green Pen — Verified Strengths</p>
                      {(sub.greenPenNotes || []).map((note, idx) => (
                        <p key={idx} className="text-xs text-emerald-900">
                          ✓ {note}
                        </p>
                      ))}
                    </div>
                    <div className="bg-red-50/90 border border-red-200 rounded-lg p-4 space-y-1.5">
                      <p className="text-xs font-bold text-red-900">Red Pen — Corrections Needed</p>
                      {(sub.redPenNotes || []).length === 0 ? (
                        <p className="text-xs text-red-900">No method deductions.</p>
                      ) : (
                        (sub.redPenNotes || []).map((note, idx) => (
                          <p key={idx} className="text-xs text-red-900">
                            ✕ {note}
                          </p>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {sub.tutorFeedback && (
                  <p className="text-xs text-slate-700">
                    <strong>Tutor Summary ({sub.markedBy}):</strong> {sub.tutorFeedback}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {section === 'analytics' && (
          <StudentProgressDashboard
            division="lower_secondary"
            user={user}
            courses={courses}
            submissions={mySubmissions}
            onGoToCourses={() => setSection('courses')}
          />
        )}

        {section === 'forum' && (
          <CourseDiscussionForum
            division="lower_secondary"
            state={state}
            user={user}
            courses={courses}
            defaultCourseId={activeCourse?.id}
            onStateChange={(next) => onStateChange(next)}
          />
        )}

        {section === 'resources' && (
          <StudentResourceLibrary
            state={state}
            user={user}
            division="lower_secondary"
            onStateChange={onStateChange}
          />
        )}
      </main>

      <footer className="bg-[#0F4C81] border-t border-[#1D5E96] px-6 py-5 text-xs text-[#E2E8F0]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-white">KWAN Lower Secondary · {classLevel}</span>
          <span>O-Level Ugandan Competence Curriculum</span>
        </div>
      </footer>

      <PaymentCheckoutModal
        open={Boolean(checkoutCourse)}
        title={checkoutCourse?.title || ''}
        subtitle={`${checkoutCourse?.subject || ''} · Lower Secondary (${checkoutCourse?.allowedClasses.join(', ')})`}
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
