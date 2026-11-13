import { useState } from 'react';
import { BookOpen, CheckCircle2, ClipboardCheck, LogOut, ShieldAlert } from 'lucide-react';
import type { PlatformState, Submission, UserAccount } from '../../types/kwan';
import { api, DIVISION_META } from '../../lib/api';
import { MarkingModal } from '../shared/MarkingModal';
import { CourseDiscussionForum } from '../shared/CourseDiscussionForum';

interface TutorWorkspaceProps {
  state: PlatformState;
  user: UserAccount;
  onStateChange: (next: PlatformState) => void;
  onLogout: () => void;
}

export function TutorWorkspace({ state, user, onStateChange, onLogout }: TutorWorkspaceProps) {
  const [markingTarget, setMarkingTarget] = useState<Submission | null>(null);

  const authorisedCourses = state.courses.filter(
    (c) => c.tutorId === user.id || (user.assignedCourseIds || []).includes(c.id)
  );
  const authorisedIds = new Set(authorisedCourses.map((c) => c.id));
  const relevantSubmissions = state.submissions.filter((s) => authorisedIds.has(s.courseId));

  return (
    <div className="min-h-screen flex flex-col bg-glass-canvas bg-dots text-slate-900">
      {/* Light-Blue Glassmorphism Header */}
      <header className="glass-header-footer text-slate-900 border-b border-sky-200/80 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-200/90 border border-sky-300 text-slate-950 font-bold flex items-center justify-center shadow-sm">
              K
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-800">KWAN Faculty Portal</p>
              <h1 className="text-lg font-bold text-slate-950">{user.name} — Tutor Workspace</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2 text-xs font-semibold text-slate-900 bg-white/75 border border-sky-300/80 rounded-lg hover:bg-white flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {!user.approved ? (
          <div className="glass-card border border-amber-300 rounded-2xl p-8 text-center max-w-2xl mx-auto space-y-3">
            <ShieldAlert className="w-10 h-10 text-amber-700 mx-auto" />
            <h2 className="text-xl font-bold text-slate-950">Tutor Account Pending Administrator Approval</h2>
            <p className="text-sm text-slate-700 leading-relaxed">
              Per KWAN governance policy, tutors must be verified and assigned to authorised divisions and courses by an Administrator before managing coursework or marking submissions.
            </p>
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-800" />
                <h2 className="text-lg font-bold text-slate-950">
                  Authorised Courses ({authorisedCourses.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {authorisedCourses.map((course) => (
                  <div key={course.id} className="glass-card rounded-2xl p-5 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-semibold text-amber-800">{DIVISION_META[course.division].short}</span>
                      <span className="font-mono-tabular">{course.allowedClasses.join(', ')}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-950">{course.title}</h3>
                    <p className="text-xs text-slate-600">
                      {course.modules.length} modules · {course.assessments.length} assessments
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-700" />
                <h2 className="text-lg font-bold text-slate-950">
                  Student Submissions &amp; Marking Queue ({relevantSubmissions.length})
                </h2>
              </div>
              <div className="glass-card rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/60 border-b border-slate-200/80 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Student</th>
                      <th className="px-4 py-3 font-semibold">Division / Class</th>
                      <th className="px-4 py-3 font-semibold">Assessment</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70">
                    {relevantSubmissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-white/60">
                        <td className="px-4 py-3 font-semibold text-slate-950">{sub.studentName}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {DIVISION_META[sub.division].short} · {sub.classLevel}
                        </td>
                        <td className="px-4 py-3 text-slate-800">{sub.assessmentTitle}</td>
                        <td className="px-4 py-3 font-mono-tabular">
                          {sub.status === 'marked' ? (
                            <span className="text-[#1f8f59] font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {sub.score}/{sub.maxScore}
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold">Pending Marking</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setMarkingTarget(sub)}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                          >
                            {sub.status === 'marked' ? 'Review Mark' : 'Mark Now'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <CourseDiscussionForum
              mode="tutor"
              state={state}
              user={user}
              courses={authorisedCourses}
              onStateChange={onStateChange}
            />
          </>
        )}
      </main>

      {/* Light-Blue Glassmorphism Footer */}
      <footer className="glass-header-footer border-t border-sky-200/80 px-6 py-5 text-xs text-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-slate-950">KWAN Faculty Portal</span>
          <span>Red &amp; Green Pen Marking · Rubric Evaluation</span>
        </div>
      </footer>

      <MarkingModal
        key={markingTarget?.id || 'none'}
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
