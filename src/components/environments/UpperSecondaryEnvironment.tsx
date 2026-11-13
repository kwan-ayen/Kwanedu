import { useState } from 'react';
import {
  BookMarked,
  CheckCircle2,
  FlaskConical,
  LogOut,
  Send,
  TrendingUp,
} from 'lucide-react';
import type { Course, PlatformState, UserAccount } from '../../types/kwan';
import { api, formatUGX, SUBJECT_COMBINATIONS } from '../../lib/api';
import { CalculusSlopeExplorer } from '../shared/InteractiveLabs';
import { PaymentCheckoutModal } from '../shared/PaymentCheckoutModal';
import { StudentProgressDashboard } from '../shared/StudentProgressDashboard';
import { CourseDiscussionForum } from '../shared/CourseDiscussionForum';
import { StudentResourceLibrary } from '../shared/StudentResourceLibrary';

interface UpperSecondaryEnvironmentProps {
  state: PlatformState;
  user: UserAccount;
  onStateChange: (next: PlatformState, updatedUser?: UserAccount) => void;
  onLogout: () => void;
  isAdminPreview?: boolean;
}

export function UpperSecondaryEnvironment({
  state,
  user,
  onStateChange,
  onLogout,
  isAdminPreview = false,
}: UpperSecondaryEnvironmentProps) {
  const [tab, setTab] = useState<'seminars' | 'research' | 'progression' | 'forum' | 'resources'>('seminars');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [researchAnswer, setResearchAnswer] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [checkoutCourse, setCheckoutCourse] = useState<Course | null>(null);
  const [savingCombo, setSavingCombo] = useState(false);

  const classLevel = user.classLevel || 'S.6';
  const courses = state.courses.filter(
    (c) => c.status === 'published' && c.division === 'upper_secondary' && c.allowedClasses.includes(classLevel)
  );
  const activeCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];
  const activeLesson = activeCourse?.modules[0]?.lessons[0];

  const mySubmissions = state.submissions.filter(
    (s) => s.studentId === user.id && s.division === 'upper_secondary'
  );

  const isEnrolled = (course: Course) =>
    course.accessType === 'free' || user.enrolledCourseIds.includes(course.id);

  const handleComboChange = async (nextCombo: string) => {
    setSavingCombo(true);
    try {
      const res = await api.updateUser(user.id, { subjectCombination: nextCombo });
      onStateChange(res.state, res.state.users.find((u) => u.id === user.id));
    } finally {
      setSavingCombo(false);
    }
  };

  const handleSubmitResearch = async (assessmentId: string) => {
    if (!activeCourse || !researchAnswer.trim()) return;
    const res = await api.submitWork({
      studentId: user.id,
      courseId: activeCourse.id,
      assessmentId,
      answerText: researchAnswer.trim(),
      attachmentName: attachmentName.trim() || `${user.name.replace(/\s+/g, '_')}_Seminar.pdf`,
    });
    setResearchAnswer('');
    setAttachmentName('');
    onStateChange(res.state, res.state.users.find((u) => u.id === user.id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-animated-canvas text-slate-900">
      <header className="glass-header-footer text-white border-b border-[#1D5E96] px-6 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img src="/kwan-mark.svg" alt="" aria-hidden="true" className="w-10 h-10 rounded-xl shadow-sm" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#34D399]">
                KWAN Upper Secondary · {user.stream ? `${user.stream} Stream · ` : ''}A-Level Track ({classLevel})
              </p>
              <h1 className="font-editorial text-2xl font-semibold text-white mt-0.5">
                {user.name} · {user.subjectCombination || 'PCM/ICT'}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'seminars', label: 'Principal Subjects' },
                { id: 'research', label: 'Research & Rubrics' },
                { id: 'progression', label: 'Combination & Analytics' },
                { id: 'forum', label: 'Seminar Forum' },
                { id: 'resources', label: 'Study Resources' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 text-xs font-semibold rounded border whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? 'bg-[#34D399] text-[#0A2540] border-[#34D399] shadow-soft'
                    : 'bg-white/10 text-[#E2E8F0] border-white/25 hover:bg-white/20 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
            {!isAdminPreview && (
              <button
                type="button"
                onClick={onLogout}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-white/10 border border-white/30 rounded hover:bg-white/20 flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {tab === 'seminars' && (
          <>
            {/* Subject Combination & Authorised Courses */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="glass-card rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                  <BookMarked className="w-4 h-4" /> Authorised Combination
                </div>
                <p className="font-editorial text-lg font-semibold text-slate-950">
                  {user.subjectCombination || 'PCM/ICT'}
                </p>
                <label className="block text-xs text-slate-600">
                  Update Registered Combination ({classLevel})
                </label>
                <select
                  disabled={savingCombo}
                  value={user.subjectCombination || SUBJECT_COMBINATIONS[0]}
                  onChange={(e) => handleComboChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300/80 rounded bg-white/85"
                >
                  {SUBJECT_COMBINATIONS.map((combo) => (
                    <option key={combo} value={combo}>
                      {combo}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  Access is filtered to {classLevel} subjects aligned with your principal track.
                </p>
              </div>

              {courses.map((course) => {
                const unlocked = isEnrolled(course);
                const selected = activeCourse?.id === course.id;
                return (
                  <div
                    key={course.id}
                    className={`glass-card rounded-xl p-5 flex flex-col justify-between transition-all ${
                      selected ? 'border-stone-900 ring-2 ring-stone-900/15' : 'hover:shadow-lift hover:bg-white/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500 font-mono-tabular mb-1">
                        <span>{course.code}</span>
                        <span>{course.subjectCombinationTag || classLevel}</span>
                      </div>
                      <h2 className="font-editorial text-lg font-semibold text-slate-950">{course.title}</h2>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">{course.summary}</p>
                    </div>
                    <div className="mt-5 pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800 tabular-nums">
                        {unlocked ? 'Authorised Access' : formatUGX(course.priceUGX)}
                      </span>
                      {unlocked ? (
                        <button
                          type="button"
                          onClick={() => setSelectedCourseId(course.id)}
                          className="px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 rounded hover:bg-stone-800 whitespace-nowrap"
                        >
                          Open Seminar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCheckoutCourse(course)}
                          className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 rounded hover:bg-amber-300 whitespace-nowrap"
                        >
                          Unlock Course
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Seminar Content + Interactive Calculus + Marking Rubric */}
            {activeCourse && isEnrolled(activeCourse) && activeLesson && (
              <section className="glass-card rounded-xl p-6 md:p-8 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-200">
                  <div>
                    <p className="text-xs font-mono-tabular text-amber-800">
                      {activeCourse.code} · {activeCourse.tutorName}
                    </p>
                    <h3 className="font-editorial text-2xl font-semibold text-slate-950 mt-1">
                      {activeLesson.title}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">{activeLesson.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await api.completeLesson(user.id, activeLesson.id);
                      onStateChange(res.state, res.user);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-950 rounded hover:bg-slate-800 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {user.completedLessonIds.includes(activeLesson.id) ? 'Seminar Logged' : 'Log Seminar Complete'}
                  </button>
                </div>

                <div className="text-sm text-slate-800 leading-relaxed bg-slate-50 border border-slate-200 rounded p-5">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Advanced Seminar Notes</p>
                  <p>{activeLesson.content}</p>
                </div>

                {activeLesson.interactiveKind === 'calculus_slope' && <CalculusSlopeExplorer />}

                {/* Detailed Assessment & Marking Rubric Matrix */}
                {activeCourse.assessments[0] && (
                  <div className="border-t border-slate-200 pt-6 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                          {activeCourse.assessments[0].type} Assessment
                        </p>
                        <h4 className="font-editorial text-xl font-semibold text-slate-950">
                          {activeCourse.assessments[0].title}
                        </h4>
                      </div>
                      <span className="font-mono-tabular text-xs font-semibold text-slate-700">
                        Max {activeCourse.assessments[0].maxScore} Marks · Threshold {activeCourse.assessments[0].minPassScore}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{activeCourse.assessments[0].instructions}</p>

                    {activeCourse.assessments[0].rubric && (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-stone-900 text-white">
                            <tr>
                              <th className="px-4 py-2.5 font-semibold">Rubric Criterion</th>
                              <th className="px-4 py-2.5 font-semibold">Descriptor</th>
                              <th className="px-4 py-2.5 font-semibold text-right">Marks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {activeCourse.assessments[0].rubric.map((r) => (
                              <tr key={r.id}>
                                <td className="px-4 py-2.5 font-semibold text-slate-900">{r.label}</td>
                                <td className="px-4 py-2.5 text-slate-600">{r.descriptor}</td>
                                <td className="px-4 py-2.5 text-right font-mono-tabular font-semibold">{r.maxMarks}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="space-y-3">
                      <textarea
                        rows={4}
                        value={researchAnswer}
                        onChange={(e) => setResearchAnswer(e.target.value)}
                        placeholder="Enter your complete analytical proof, derivations, or practical error analysis..."
                        className="w-full px-4 py-3 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <input
                          type="text"
                          value={attachmentName}
                          onChange={(e) => setAttachmentName(e.target.value)}
                          placeholder="Research manuscript filename (e.g. Lab_Report.pdf)"
                          className="flex-1 min-w-[220px] px-3 py-2 text-xs border border-slate-300 rounded"
                        />
                        <button
                          type="button"
                          disabled={!researchAnswer.trim()}
                          onClick={() => handleSubmitResearch(activeCourse.assessments[0].id)}
                          className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-950 rounded hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                        >
                          <Send className="w-3.5 h-3.5" /> Submit for Rubric Evaluation
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {tab === 'research' && (
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <FlaskConical className="w-5 h-5 text-amber-700" />
              <div>
                <h2 className="font-editorial text-xl font-semibold text-slate-950">
                  Research Projects, Practical Submissions & Rubric Evaluations
                </h2>
                <p className="text-xs text-slate-600">
                  Inspect criterion-by-criterion scoring and subject-specific lecturer feedback.
                </p>
              </div>
            </div>
            {mySubmissions.map((sub) => (
              <div key={sub.id} className="glass-card rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-200">
                  <div>
                    <p className="text-xs font-mono-tabular text-slate-500">{sub.courseTitle}</p>
                    <h3 className="font-editorial text-lg font-semibold text-slate-950">{sub.assessmentTitle}</h3>
                  </div>
                  <span className="text-sm font-mono-tabular font-bold text-slate-950">
                    {sub.status === 'marked' ? `${sub.score} / ${sub.maxScore}` : 'Awaiting Rubric Evaluation'}
                  </span>
                </div>
                <p className="text-xs text-slate-700 glass-panel rounded p-3">{sub.answerText}</p>
                {sub.rubricBreakdown && sub.rubricBreakdown.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {sub.rubricBreakdown.map((rb) => (
                      <div key={rb.criterionId} className="glass-panel rounded p-3">
                        <p className="text-xs text-slate-500">{rb.label}</p>
                        <p className="font-mono-tabular text-sm font-bold text-slate-950 mt-1">
                          {rb.awarded} / {rb.maxMarks}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {sub.tutorFeedback && (
                  <p className="text-xs text-slate-800">
                    <strong>Subject Feedback ({sub.markedBy}):</strong> {sub.tutorFeedback}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {tab === 'progression' && (
          <div className="space-y-6">
            <section className="glass-card rounded-xl p-6 space-y-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-slate-900" />
                <div>
                  <h2 className="font-editorial text-xl font-semibold text-slate-950">
                    Academic Progression &amp; UACE Readiness
                  </h2>
                  <p className="text-xs text-slate-600">
                    Track standing across principal papers and Upper Secondary mastery benchmarks (≥ 75%).
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-panel rounded p-4">
                  <p className="text-xs text-slate-500">Class Standing</p>
                  <p className="text-xl font-bold text-slate-950 mt-1">{classLevel}</p>
                </div>
                <div className="glass-panel rounded p-4">
                  <p className="text-xs text-slate-500">Combination</p>
                  <p className="text-sm font-bold text-slate-950 mt-1">{user.subjectCombination || 'PCM/ICT'}</p>
                </div>
                <div className="glass-panel rounded p-4">
                  <p className="text-xs text-slate-500">Seminars Completed</p>
                  <p className="text-xl font-bold font-mono-tabular text-slate-950 mt-1">{user.completedLessonIds.length}</p>
                </div>
                <div className="glass-panel rounded p-4">
                  <p className="text-xs text-slate-500">Graded Assessments</p>
                  <p className="text-xl font-bold font-mono-tabular text-slate-950 mt-1">
                    {mySubmissions.filter((s) => s.status === 'marked').length}
                  </p>
                </div>
              </div>
            </section>

            <StudentProgressDashboard
              division="upper_secondary"
              user={user}
              courses={courses}
              submissions={mySubmissions}
              onGoToCourses={() => setTab('seminars')}
            />
          </div>
        )}

        {tab === 'forum' && (
          <CourseDiscussionForum
            division="upper_secondary"
            state={state}
            user={user}
            courses={courses}
            defaultCourseId={activeCourse?.id}
            onStateChange={(next) => onStateChange(next)}
          />
        )}

        {tab === 'resources' && (
          <StudentResourceLibrary
            state={state}
            user={user}
            division="upper_secondary"
            onStateChange={onStateChange}
          />
        )}
      </main>

      <footer className="bg-[#0F4C81] border-t border-[#1D5E96] px-6 py-5 text-xs text-[#E2E8F0]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-white">KWAN Upper Secondary · {user.subjectCombination || 'PCM/ICT'}</span>
          <span>UACE Research &amp; Principal Seminar Track</span>
        </div>
      </footer>

      <PaymentCheckoutModal
        open={Boolean(checkoutCourse)}
        title={checkoutCourse?.title || ''}
        subtitle={`${checkoutCourse?.subject || ''} · Upper Secondary (${checkoutCourse?.allowedClasses.join(', ')})`}
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
