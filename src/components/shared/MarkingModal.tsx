import { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import type { Course, Submission } from '../../types/kwan';

interface MarkingModalProps {
  submission: Submission | null;
  course?: Course;
  markerName: string;
  onClose: () => void;
  onSaveMark: (
    submissionId: string,
    payload: {
      score: number;
      greenPenNotes: string[];
      redPenNotes: string[];
      tutorFeedback: string;
      markedBy: string;
      rubricBreakdown?: { criterionId: string; label: string; awarded: number; maxMarks: number }[];
    }
  ) => Promise<void>;
}

export function MarkingModal({
  submission,
  course,
  markerName,
  onClose,
  onSaveMark,
}: MarkingModalProps) {
  const assessment = course?.assessments.find((a) => a.id === submission?.assessmentId);
  const rubric = assessment?.rubric || [];

  const [score, setScore] = useState<number>(submission?.score ?? Math.round((submission?.maxScore || 20) * 0.8));
  const [greenText, setGreenText] = useState(
    (submission?.greenPenNotes || ['Clear method and accurate step-by-step layout.']).join('\n')
  );
  const [redText, setRedText] = useState((submission?.redPenNotes || []).join('\n'));
  const [feedback, setFeedback] = useState(
    submission?.tutorFeedback || 'Well structured submission. Review the highlighted notes for full marks.'
  );
  const [rubricScores, setRubricScores] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    rubric.forEach((r) => {
      const existing = submission?.rubricBreakdown?.find((b) => b.criterionId === r.id);
      map[r.id] = existing ? existing.awarded : Math.round(r.maxMarks * 0.8);
    });
    return map;
  });
  const [saving, setSaving] = useState(false);

  if (!submission) return null;

  const computedScore =
    rubric.length > 0 ? rubric.reduce((sum, r) => sum + (rubricScores[r.id] ?? 0), 0) : score;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSaveMark(submission.id, {
        score: computedScore,
        greenPenNotes: greenText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        redPenNotes: redText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        tutorFeedback: feedback.trim(),
        markedBy: markerName,
        rubricBreakdown:
          rubric.length > 0
            ? rubric.map((r) => ({
                criterionId: r.id,
                label: r.label,
                awarded: rubricScores[r.id] ?? 0,
                maxMarks: r.maxMarks,
              }))
            : undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white/90 backdrop-blur-2xl border border-white/85 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-lift my-8">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-semibold text-teal-800">
              {submission.division.replace('_', ' ')} · {submission.classLevel} · {submission.studentName}
            </p>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">{submission.assessmentTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="glass-panel rounded-xl p-4 text-xs text-slate-800 space-y-1">
          <p className="font-semibold text-slate-900">Student Submission:</p>
          <p className="leading-relaxed">{submission.answerText}</p>
          {submission.attachmentName && (
            <p className="text-slate-500 pt-1">Attachment: {submission.attachmentName}</p>
          )}
        </div>

        {rubric.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-900">Upper Secondary Rubric Scoring</p>
            <div className="space-y-2">
              {rubric.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 rounded-lg p-3 bg-white/70"
                >
                  <div className="max-w-md">
                    <p className="text-xs font-semibold text-slate-900">{r.label}</p>
                    <p className="text-xs text-slate-500">{r.descriptor}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={r.maxMarks}
                      value={rubricScores[r.id] ?? 0}
                      onChange={(e) =>
                        setRubricScores((prev) => ({
                          ...prev,
                          [r.id]: Math.min(r.maxMarks, Math.max(0, Number(e.target.value))),
                        }))
                      }
                      className="w-16 px-2 py-1 text-xs font-mono-tabular border border-slate-300 rounded bg-white"
                    />
                    <span className="text-xs text-slate-500 font-mono-tabular">/ {r.maxMarks}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1">
              Awarded Score (Max {submission.maxScore})
            </label>
            <input
              type="number"
              min={0}
              max={submission.maxScore}
              value={score}
              onChange={(e) => setScore(Math.min(submission.maxScore, Math.max(0, Number(e.target.value))))}
              className="w-32 px-3 py-2 text-sm font-mono-tabular border border-slate-300 rounded-lg bg-white"
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-emerald-800 mb-1">
              Green Pen Notes (Strengths · 1 per line)
            </label>
            <textarea
              rows={3}
              value={greenText}
              onChange={(e) => setGreenText(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-emerald-300 bg-emerald-50/50 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-red-800 mb-1">
              Red Pen Notes (Corrections · 1 per line)
            </label>
            <textarea
              rows={3}
              value={redText}
              onChange={(e) => setRedText(e.target.value)}
              placeholder="Optional corrections or missing steps..."
              className="w-full px-3 py-2 text-xs border border-red-300 bg-red-50/50 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-900 mb-1">Overall Tutor Feedback</label>
          <textarea
            rows={2}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <span className="text-xs font-mono-tabular font-semibold text-slate-700">
            Total: {computedScore} / {submission.maxScore} (
            {Math.round((computedScore / submission.maxScore) * 100)}%)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? 'Saving...' : 'Publish Marking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
