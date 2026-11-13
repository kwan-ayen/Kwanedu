import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, BookOpenCheck, CheckCircle2, ClipboardCheck, TrendingUp } from 'lucide-react';
import type { Course, DivisionId, Submission, UserAccount } from '../../types/kwan';

export interface LocalPracticeScore {
  id: string;
  courseId: string;
  courseTitle: string;
  subject: string;
  title: string;
  score: number;
  maxScore: number;
  dateLabel: string;
}

const DIVISION_BENCHMARKS: Record<DivisionId, number> = {
  primary: 65,
  lower_secondary: 70,
  upper_secondary: 75,
};

interface StudentProgressDashboardProps {
  division: DivisionId;
  user: UserAccount;
  courses: Course[];
  submissions: Submission[];
  localPracticeScores?: LocalPracticeScore[];
  onGoToCourses?: () => void;
}

interface CompletionPoint {
  courseId: string;
  subject: string;
  courseTitle: string;
  completionRate: number;
  completedLessons: number;
  totalLessons: number;
  unlocked: boolean;
}

interface ScorePoint {
  id: string;
  courseId: string;
  label: string;
  fullTitle: string;
  subject: string;
  scorePercent: number;
  rawScore: number;
  maxScore: number;
  dateLabel: string;
  source: string;
}

interface TooltipPayloadEntry<T> {
  payload: T;
}

function CompletionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry<CompletionPoint>[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-stone-900/95 backdrop-blur-md text-white border border-white/15 rounded-xl px-3.5 py-2.5 text-xs shadow-lift space-y-1 max-w-xs">
      <p className="font-bold text-white">{item.courseTitle}</p>
      <p className="text-slate-200">
        Completion: <strong className="font-mono-tabular text-[#f28c28]">{item.completionRate}%</strong>
      </p>
      <p className="text-slate-300 font-mono-tabular">
        {item.completedLessons} / {item.totalLessons} lessons finished
      </p>
    </div>
  );
}

function ScoreTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry<ScorePoint>[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-stone-900/95 backdrop-blur-md text-white border border-white/15 rounded-xl px-3.5 py-2.5 text-xs shadow-lift space-y-1 max-w-xs">
      <p className="font-bold text-white">{item.fullTitle}</p>
      <p className="text-slate-200">
        {item.subject} · {item.source}
      </p>
      <p className="text-[#2bb673] font-mono-tabular font-semibold">
        {item.scorePercent}% ({item.rawScore} / {item.maxScore})
      </p>
      <p className="text-slate-300 font-mono-tabular">{item.dateLabel}</p>
    </div>
  );
}

const DIVISION_PALETTES: Record<
  DivisionId,
  {
    primaryBar: string;
    secondaryBar: string;
    scoreLine: string;
    thresholdLine: string;
    cardClass: string;
    headingFontClass: string;
    completionHeading: string;
    scoreHeading: string;
  }
> = {
  primary: {
    primaryBar: '#f28c28',
    secondaryBar: '#10b981',
    scoreLine: '#2bb673',
    thresholdLine: '#f28c28',
    cardClass: 'glass-card border-2 border-amber-200/80 rounded-2xl',
    headingFontClass: 'font-kids font-bold text-[#292524]',
    completionHeading: 'Subject Completion Progress',
    scoreHeading: 'Quiz & Activity Scores Over Time',
  },
  lower_secondary: {
    primaryBar: '#0f766e',
    secondaryBar: '#f28c28',
    scoreLine: '#0f766e',
    thresholdLine: '#2bb673',
    cardClass: 'glass-card rounded-2xl',
    headingFontClass: 'font-bold text-slate-900',
    completionHeading: 'Course & Module Completion Rates',
    scoreHeading: 'Quizzes & Marked Coursework Scores',
  },
  upper_secondary: {
    primaryBar: '#18181b',
    secondaryBar: '#f28c28',
    scoreLine: '#f28c28',
    thresholdLine: '#18181b',
    cardClass: 'glass-card rounded-xl',
    headingFontClass: 'font-editorial font-semibold text-stone-900',
    completionHeading: 'Principal Subject Seminar Completion',
    scoreHeading: 'Practical, Quiz & Rubric Score Trajectory',
  },
};

export function StudentProgressDashboard({
  division,
  user,
  courses,
  submissions,
  localPracticeScores = [],
  onGoToCourses,
}: StudentProgressDashboardProps) {
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const palette = DIVISION_PALETTES[division];
  const passThreshold = DIVISION_BENCHMARKS[division];

  const isEnrolled = (course: Course) =>
    course.accessType === 'free' || user.enrolledCourseIds.includes(course.id);

  const completionData = useMemo<CompletionPoint[]>(() => {
    return courses
      .filter((c) => selectedCourseFilter === 'all' || c.id === selectedCourseFilter)
      .map((course) => {
        const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
        const completedLessons = lessonIds.filter((id) => user.completedLessonIds.includes(id)).length;
        const totalLessons = lessonIds.length;
        const completionRate = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
        return {
          courseId: course.id,
          subject: course.subject.length > 16 ? `${course.subject.slice(0, 15)}…` : course.subject,
          courseTitle: course.title,
          completionRate,
          completedLessons,
          totalLessons,
          unlocked: isEnrolled(course),
        };
      });
  }, [courses, selectedCourseFilter, user.completedLessonIds, user.enrolledCourseIds]);

  const scoreData = useMemo<ScorePoint[]>(() => {
    const markedSubs: ScorePoint[] = submissions
      .filter((s) => s.status === 'marked' && s.score !== undefined && s.maxScore > 0)
      .filter((s) => selectedCourseFilter === 'all' || s.courseId === selectedCourseFilter)
      .map((s) => {
        const matchedCourse = courses.find((c) => c.id === s.courseId);
        const pct = Math.round(((s.score || 0) / s.maxScore) * 100);
        return {
          id: s.id,
          courseId: s.courseId,
          label:
            s.assessmentTitle.length > 18 ? `${s.assessmentTitle.slice(0, 17)}…` : s.assessmentTitle,
          fullTitle: s.assessmentTitle,
          subject: matchedCourse?.subject || s.courseTitle,
          scorePercent: pct,
          rawScore: s.score || 0,
          maxScore: s.maxScore,
          dateLabel: s.markedAt || s.submittedAt,
          source: s.assessmentTitle.toLowerCase().includes('quiz') ? 'Quiz' : 'Marked Assessment',
        };
      });

    const practicePts: ScorePoint[] = localPracticeScores
      .filter((p) => selectedCourseFilter === 'all' || p.courseId === selectedCourseFilter)
      .map((p) => ({
        id: p.id,
        courseId: p.courseId,
        label: p.title.length > 18 ? `${p.title.slice(0, 17)}…` : p.title,
        fullTitle: p.title,
        subject: p.subject,
        scorePercent: p.maxScore > 0 ? Math.round((p.score / p.maxScore) * 100) : 0,
        rawScore: p.score,
        maxScore: p.maxScore,
        dateLabel: p.dateLabel,
        source: 'Practice Quiz',
      }));

    return [...markedSubs, ...practicePts].sort((a, b) => a.dateLabel.localeCompare(b.dateLabel));
  }, [submissions, localPracticeScores, selectedCourseFilter, courses]);

  const totalLessonsAcrossCourses = completionData.reduce((sum, c) => sum + c.totalLessons, 0);
  const completedLessonsAcrossCourses = completionData.reduce((sum, c) => sum + c.completedLessons, 0);
  const overallCompletionRate =
    totalLessonsAcrossCourses > 0
      ? Math.round((completedLessonsAcrossCourses / totalLessonsAcrossCourses) * 100)
      : 0;

  const averageQuizScore =
    scoreData.length > 0
      ? Math.round(scoreData.reduce((sum, s) => sum + s.scorePercent, 0) / scoreData.length)
      : null;

  return (
    <div className="space-y-6">
      {/* Header & Subject Filter */}
      <div className={`${palette.cardClass} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-slate-800 shrink-0" />
          <div>
            <h2 className={`text-lg ${palette.headingFontClass}`}>
              Student Progress &amp; Performance Dashboard
            </h2>
            <p className="text-xs text-slate-600">
              {user.classLevel || ''} · Passing benchmark: {passThreshold}% · Live completion &amp; assessment telemetry
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="progress-subject-filter" className="text-xs font-semibold text-slate-600">
            Subject Filter
          </label>
          <select
            id="progress-subject-filter"
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-900"
          >
            <option value="all">All Class Subjects ({courses.length})</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.subject} — {c.code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${palette.cardClass} p-4`}>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <BookOpenCheck className="w-3.5 h-3.5 text-slate-500" /> Overall Completion
          </p>
          <p className="text-2xl font-bold font-mono-tabular text-slate-950 mt-1">{overallCompletionRate}%</p>
          <p className="text-[11px] text-slate-500 font-mono-tabular mt-0.5">
            {completedLessonsAcrossCourses} / {totalLessonsAcrossCourses} lessons
          </p>
        </div>

        <div className={`${palette.cardClass} p-4`}>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-slate-500" /> Average Quiz &amp; Score
          </p>
          <p className="text-2xl font-bold font-mono-tabular text-slate-950 mt-1">
            {averageQuizScore !== null ? `${averageQuizScore}%` : '—'}
          </p>
          <p className="text-[11px] text-slate-500 font-mono-tabular mt-0.5">
            {scoreData.length} graded score{scoreData.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className={`${palette.cardClass} p-4`}>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> Courses Unlocked
          </p>
          <p className="text-2xl font-bold font-mono-tabular text-slate-950 mt-1">
            {courses.filter(isEnrolled).length} / {courses.length}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Division curriculum access</p>
        </div>

        <div className={`${palette.cardClass} p-4`}>
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5 text-slate-500" /> Lessons Completed
          </p>
          <p className="text-2xl font-bold font-mono-tabular text-slate-950 mt-1">
            {completedLessonsAcrossCourses}
          </p>
          <p className="text-[11px] text-slate-500 font-mono-tabular mt-0.5">
            Target ≥ {passThreshold}% standing
          </p>
        </div>
      </div>

      {/* Charts Grid: Course Completion BarChart + Quiz Scores LineChart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Course Completion Rates */}
        <div className={`${palette.cardClass} p-5 space-y-4`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className={`text-base ${palette.headingFontClass}`}>{palette.completionHeading}</h3>
              <p className="text-xs text-slate-500">
                Percentage of lessons completed per approved subject
              </p>
            </div>
            <span className="text-xs font-mono-tabular text-slate-600">0–100%</span>
          </div>

          {completionData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-700">No subjects available for this filter.</p>
              {onGoToCourses && (
                <button
                  type="button"
                  onClick={onGoToCourses}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                >
                  Open Subjects
                </button>
              )}
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={completionData} margin={{ top: 10, right: 16, left: -12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="subject" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip content={<CompletionTooltip />} />
                  <Bar dataKey="completionRate" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {completionData.map((entry, idx) => (
                      <Cell
                        key={entry.courseId}
                        fill={idx % 2 === 0 ? palette.primaryBar : palette.secondaryBar}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Chart 2: Quiz & Assessment Scores */}
        <div className={`${palette.cardClass} p-5 space-y-4`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className={`text-base ${palette.headingFontClass}`}>{palette.scoreHeading}</h3>
              <p className="text-xs text-slate-500">
                Chronological quiz &amp; marked assessment percentages vs {passThreshold}% target
              </p>
            </div>
            <span className="text-xs font-mono-tabular text-slate-600">Target {passThreshold}%</span>
          </div>

          {scoreData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-700">
                No graded quiz or assignment scores recorded yet.
              </p>
              <p className="text-[11px] text-slate-500 max-w-xs">
                Complete a lesson quiz or submit an assignment to track your score trajectory here.
              </p>
              {onGoToCourses && (
                <button
                  type="button"
                  onClick={onGoToCourses}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg"
                >
                  Start a Quiz or Lesson
                </button>
              )}
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={scoreData} margin={{ top: 10, right: 16, left: -12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip content={<ScoreTooltip />} />
                  <ReferenceLine
                    y={passThreshold}
                    stroke={palette.thresholdLine}
                    strokeDasharray="4 4"
                    label={{
                      value: `Pass ${passThreshold}%`,
                      position: 'insideTopRight',
                      fontSize: 10,
                      fill: palette.thresholdLine,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="scorePercent"
                    stroke={palette.scoreLine}
                    strokeWidth={2.5}
                    dot={{ r: 4.5, fill: palette.scoreLine, strokeWidth: 2, stroke: '#FFFFFF' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Subject & Score Breakdown Table */}
      <div className={`${palette.cardClass} overflow-hidden`}>
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className={`text-sm ${palette.headingFontClass}`}>Detailed Course &amp; Assessment Breakdown</h3>
          <span className="text-xs font-mono-tabular text-slate-500">
            {completionData.length} subject{completionData.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Subject / Course</th>
                <th className="px-5 py-2.5 font-semibold">Access</th>
                <th className="px-5 py-2.5 font-semibold text-right">Lessons Done</th>
                <th className="px-5 py-2.5 font-semibold text-right">Completion Rate</th>
                <th className="px-5 py-2.5 font-semibold text-right">Latest Quiz / Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {completionData.map((row) => {
                const courseScores = scoreData.filter((s) => s.courseId === row.courseId);
                const latest = courseScores[courseScores.length - 1];
                return (
                  <tr key={row.courseId} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-medium text-slate-900">{row.courseTitle}</td>
                    <td className="px-5 py-3 text-slate-600">{row.unlocked ? 'Enrolled' : 'Locked'}</td>
                    <td className="px-5 py-3 text-right font-mono-tabular text-slate-700">
                      {row.completedLessons} / {row.totalLessons}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-tabular font-semibold text-slate-900">
                      {row.completionRate}%
                    </td>
                    <td className="px-5 py-3 text-right font-mono-tabular text-slate-900">
                      {latest ? `${latest.scorePercent}% (${latest.rawScore}/${latest.maxScore})` : 'Pending'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
