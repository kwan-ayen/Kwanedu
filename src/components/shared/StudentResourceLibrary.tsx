import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Download, Eye, X } from 'lucide-react';
import type { DivisionId, PlatformState, ResourceItem, UserAccount } from '../../types/kwan';
import { api, DIVISION_META, formatUGX } from '../../lib/api';
import { PaymentCheckoutModal } from './PaymentCheckoutModal';

interface StudentResourceLibraryProps {
  state: PlatformState;
  user: UserAccount;
  division: DivisionId;
  onStateChange: (state: PlatformState, user?: UserAccount) => void;
}

export function StudentResourceLibrary({ state, user, division, onStateChange }: StudentResourceLibraryProps) {
  const [preview, setPreview] = useState<ResourceItem | null>(null);
  const [checkout, setCheckout] = useState<ResourceItem | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ resourceId: string; url: string; fileName: string } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState('');
  const classLevel = user.classLevel;
  const resources = state.resources.filter(
    (resource) =>
      resource.approved &&
      resource.division === division &&
      (!classLevel || resource.targetClasses.length === 0 || resource.targetClasses.includes(classLevel))
  );

  const owned = (resource: ResourceItem) =>
    resource.accessType === 'free' || user.purchasedResourceIds.includes(resource.id);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setPdfPreview(null);
    setFileLoading(false);
    setFileError('');

    if (!preview?.attachment || preview.attachment.mimeType !== 'application/pdf') {
      return () => {
        active = false;
      };
    }

    setFileLoading(true);
    api.fetchResourceFile(preview.id)
      .then(({ blob, fileName }) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setPdfPreview({ resourceId: preview.id, url: objectUrl, fileName });
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((err) => {
        if (active) setFileError(err instanceof Error ? err.message : 'Unable to load the PDF preview.');
      })
      .finally(() => {
        if (active) setFileLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [preview]);

  const downloadAttachment = async (resource: ResourceItem) => {
    setFileError('');
    let objectUrl: string | null = null;
    try {
      const cachedPdf = pdfPreview?.resourceId === resource.id ? pdfPreview : null;
      const file = cachedPdf ? null : await api.fetchResourceFile(resource.id);
      const link = document.createElement('a');
      if (cachedPdf) {
        link.href = cachedPdf.url;
        link.download = cachedPdf.fileName;
      } else if (file) {
        objectUrl = URL.createObjectURL(file.blob);
        link.href = objectUrl;
        link.download = file.fileName;
      } else {
        throw new Error('Resource file is unavailable.');
      }
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Unable to download the resource file.');
    } finally {
      const downloadUrl = objectUrl;
      if (downloadUrl) window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#0F4C81]">
          {DIVISION_META[division].short} · {classLevel || 'Learning Resources'}
        </p>
        <h2 className="text-2xl font-bold text-slate-950 mt-1">Study Resources</h2>
        <p className="text-sm text-slate-600 mt-1">
          Browse approved notes, past papers, lab guides, and revision workbooks for your class.
        </p>
      </div>

      {resources.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">No resources are available for this class yet.</p>
          <p className="text-xs text-slate-500 mt-1">Check again later for newly published study materials.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {resources.map((resource) => (
            <article key={resource.id} className="glass-card rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-[#E6F2F2] px-3 py-1 text-[11px] font-semibold text-[#0F4C81]">
                  {resource.format}
                </span>
                <span className="text-sm font-bold text-slate-900 tabular-nums">{formatUGX(resource.priceUGX)}</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-950">{resource.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{resource.description || resource.category}</p>
                <p className="text-[11px] text-slate-500">
                  {resource.targetClasses.join(', ') || DIVISION_META[division].badgeText}
                </p>
                {resource.attachment && (
                  <p className="truncate text-[11px] font-medium text-[#0F4C81]" title={resource.attachment.fileName}>
                    File: {resource.attachment.fileName}
                  </p>
                )}
              </div>
              <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                {owned(resource) ? (
                  <button
                    type="button"
                    onClick={() => setPreview(resource)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0A2540]"
                  >
                    <Eye className="w-3.5 h-3.5" /> View resource
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCheckout(resource)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#059669]"
                  >
                    <Download className="w-3.5 h-3.5" /> Get resource
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-lift max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold text-[#0F4C81]">{preview.format} · {preview.category}</p>
                <h3 className="text-xl font-bold text-slate-950 mt-1">{preview.title}</h3>
              </div>
              <button type="button" onClick={() => setPreview(null)} aria-label="Close resource" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-600 my-4">{preview.description}</p>
            {preview.attachment?.mimeType === 'application/pdf' ? (
              fileLoading ? (
                <div className="rounded-xl bg-[#F4F7F6] p-10 text-center text-sm text-slate-600">Loading PDF preview…</div>
              ) : pdfPreview ? (
                <iframe
                  src={pdfPreview.url}
                  title={`PDF preview: ${preview.title}`}
                  className="h-[65vh] w-full rounded-xl border border-slate-200 bg-slate-100"
                />
              ) : (
                <div className="rounded-xl bg-[#F4F7F6] p-6 text-sm text-slate-600">
                  The PDF preview could not be loaded. Download the file to view it.
                </div>
              )
            ) : (
              <div className="rounded-xl bg-[#F4F7F6] p-5 text-sm leading-7 text-slate-800 whitespace-pre-wrap">
                {preview.previewContent || 'A preview for this resource has not been added yet. Please contact your tutor for assistance.'}
              </div>
            )}
            {fileError && <p role="alert" className="mt-3 text-sm text-red-700">{fileError}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {preview.attachment && (
                <button
                  type="button"
                  onClick={() => downloadAttachment(preview)}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#10B981] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#059669]"
                >
                  <Download className="w-4 h-4" /> Download {preview.attachment.fileName}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F4C81] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0A2540]"
              >
                <CheckCircle2 className="w-4 h-4" /> Done reading
              </button>
            </div>
          </div>
        </div>
      )}

      <PaymentCheckoutModal
        open={Boolean(checkout)}
        title={checkout?.title || ''}
        subtitle={`${checkout?.format || ''} · ${DIVISION_META[division].short}`}
        amountUGX={checkout?.priceUGX || 0}
        onClose={() => setCheckout(null)}
        onConfirm={async (method) => {
          if (!checkout) return;
          const result = await api.purchaseItem({
            userId: user.id,
            itemType: 'resource',
            itemId: checkout.id,
            method,
          });
          onStateChange(result.state, result.user);
          setCheckout(null);
        }}
      />
    </section>
  );
}
