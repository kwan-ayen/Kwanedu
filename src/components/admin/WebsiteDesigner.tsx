import { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  ImagePlus,
  Laptop,
  Plus,
  RotateCcw,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
  UploadCloud,
} from 'lucide-react';
import type {
  CmsEditablePageId,
  CmsMediaAsset,
  DivisionId,
  HeroSlide,
  PlatformState,
  PublicPageId,
  WebsiteConfig,
  WebsiteSection,
} from '../../types/kwan';
import { api } from '../../lib/api';
import { SafeImage } from '../shared/SafeImage';
import { HeroImageSlider } from '../shared/HeroImageSlider';

interface WebsiteDesignerProps {
  state: PlatformState;
  adminName: string;
  onStateChange: (next: PlatformState) => void;
}

const FALLBACK_GALLERY = [
  { id: 'media-1', label: 'Sunlit KWAN Library Banner', url: '/src/assets/images/hero_kwan_learning_1794577150584.jpg' },
  { id: 'media-2', label: 'Primary P.4–P.7 Classroom Banner', url: '/src/assets/images/division_primary_1794577152032.jpg' },
  { id: 'media-3', label: 'Lower Secondary STEM Lab Banner', url: '/src/assets/images/division_lower_secondary_1794577152479.jpg' },
  { id: 'media-4', label: 'Upper Secondary Reading Hall Banner', url: '/src/assets/images/division_upper_secondary_1794577153179.jpg' },
  { id: 'media-5', label: 'Term III Exam Revision Clinic Banner', url: '/src/assets/images/blog_exam_prep_1794577153176.jpg' },
];

export function WebsiteDesigner({ state, adminName, onStateChange }: WebsiteDesignerProps) {
  const [draft, setDraft] = useState<WebsiteConfig>(() => structuredClone(state.cmsDraft));
  const [activePage, setActivePage] = useState<CmsEditablePageId>('home');
  const [selectedSectionId, setSelectedSectionId] = useState<string>(
    () => state.cmsDraft.pages.home[0]?.id || ''
  );
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [publishLabel, setPublishLabel] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Promotional Banner Upload State
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerLabelInput, setBannerLabelInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const mainUploadRef = useRef<HTMLInputElement | null>(null);

  const mediaLibrary: CmsMediaAsset[] =
    state.cmsMedia && state.cmsMedia.length > 0
      ? state.cmsMedia
      : FALLBACK_GALLERY.map((g) => ({
          ...g,
          uploadedAt: '2026-11-01',
          uploadedBy: 'KWAN Design Studio',
        }));

  const sections = draft.pages[activePage] || [];
  const selectedSection = sections.find((s) => s.id === selectedSectionId) || sections[0];

  const notifyStatus = (msg: string) => {
    setErrorMessage('');
    setStatusMessage(msg);
    window.setTimeout(() => setStatusMessage(''), 4000);
  };

  const updateSection = (sectionId: string, patch: Partial<WebsiteSection>) => {
    setDraft((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        [activePage]: prev.pages[activePage].map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
      },
    }));
  };

  const moveSection = (index: number, delta: -1 | 1) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= sections.length) return;
    const copy = [...sections];
    const [moved] = copy.splice(index, 1);
    copy.splice(nextIdx, 0, moved);
    setDraft((prev) => ({
      ...prev,
      pages: { ...prev.pages, [activePage]: copy },
    }));
  };

  const moveSlide = (sectionId: string, slides: HeroSlide[], index: number, delta: -1 | 1) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= slides.length) return;
    const copy = [...slides];
    const [moved] = copy.splice(index, 1);
    copy.splice(nextIdx, 0, moved);
    updateSection(sectionId, { slides: copy });
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read selected image file.'));
      reader.readAsDataURL(file);
    });

  const handleUploadBannerFile = async (file: File, targetSlideId?: string) => {
    setErrorMessage('');
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please choose an image file (PNG, JPG, WEBP, GIF, or SVG).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErrorMessage('Banner image must be 8 MB or smaller.');
      return;
    }

    setUploadingBanner(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const customLabel = bannerLabelInput.trim() || file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      const res = await api.uploadCmsBanner({
        filename: file.name,
        dataUrl,
        label: customLabel,
        uploadedBy: adminName,
      });
      onStateChange(res.state);
      setBannerLabelInput('');

      if (selectedSection && selectedSection.type === 'hero') {
        const existingSlides = selectedSection.slides || [];
        if (targetSlideId) {
          updateSection(selectedSection.id, {
            slides: existingSlides.map((s) => (s.id === targetSlideId ? { ...s, imageUrl: res.asset.url } : s)),
          });
          notifyStatus(`Uploaded "${res.asset.label}" and updated banner slide.`);
        } else {
          const newSlide: HeroSlide = {
            id: `slide-${Date.now()}`,
            imageUrl: res.asset.url,
            divisionLabel: 'Promotional Banner',
            title: res.asset.label,
            caption: 'New uploaded promotional campaign banner—edit headline, caption, and action button.',
            ctaLabel: 'Get Started',
            ctaTarget: 'get_started',
            active: true,
          };
          updateSection(selectedSection.id, { slides: [...existingSlides, newSlide] });
          notifyStatus(`Uploaded "${res.asset.label}" and added to Hero Slider.`);
        }
      } else {
        notifyStatus(`Uploaded "${res.asset.label}" to CMS Media Library.`);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to upload banner image.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleDeleteMedia = async (assetId: string, assetUrl: string) => {
    setErrorMessage('');
    try {
      const res = await api.deleteCmsMedia(assetId);
      onStateChange(res.state);
      if (selectedSection && selectedSection.slides?.some((s) => s.imageUrl === assetUrl)) {
        updateSection(selectedSection.id, {
          slides: selectedSection.slides.filter((s) => s.imageUrl !== assetUrl),
        });
      }
      notifyStatus('Media asset removed from library.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to delete media asset.');
    }
  };

  const addSection = (type: WebsiteSection['type']) => {
    const newSec: WebsiteSection = {
      id: `sec-${Date.now()}`,
      type,
      heading:
        type === 'featured_courses'
          ? 'Featured Academic Courses'
          : type === 'promo_banner'
          ? 'Term Enrolment & Revision Clinic Announcement'
          : 'New KWAN Content Section',
      subheading: 'Designed directly in KWAN Website Management.',
      bodyText: 'Edit this section text, colours, button label, and image using the design controls.',
      ctaLabel: 'Get Started',
      ctaTarget: 'get_started',
      backgroundColor: type === 'promo_banner' ? '#faf7f0' : '#f6f5f0',
      textColor: '#0f172a',
      imageUrl: mediaLibrary[0]?.url || FALLBACK_GALLERY[0].url,
      visible: true,
    };
    setDraft((prev) => ({
      ...prev,
      pages: { ...prev.pages, [activePage]: [...prev.pages[activePage], newSec] },
    }));
    setSelectedSectionId(newSec.id);
  };

  const handleSaveDraft = async () => {
    const res = await api.saveCmsDraft(draft);
    onStateChange(res.state);
    notifyStatus('Draft saved.');
  };

  const handlePublish = async () => {
    const res = await api.publishCms(draft, publishLabel.trim() || undefined, adminName);
    onStateChange(res.state);
    setPublishLabel('');
    notifyStatus('Published live to public website.');
  };

  const handleRestore = async (versionId: string) => {
    const res = await api.restoreCmsVersion(versionId);
    setDraft(structuredClone(res.state.cmsDraft));
    onStateChange(res.state);
    setShowHistory(false);
    notifyStatus('Previous version restored and published.');
  };

  return (
    <div className="space-y-6">
      {/* Top Designer Toolbar */}
      <div className="glass-card rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'home', label: 'Home' },
              { id: 'about', label: 'About Us' },
              { id: 'blog', label: 'Blog' },
              { id: 'resources', label: 'Resources' },
              { id: 'get_started', label: 'Get Started' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setActivePage(p.id);
                setSelectedSectionId(draft.pages[p.id][0]?.id || '');
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap ${
                activePage === p.id ? 'bg-slate-900 text-white' : 'bg-white/75 text-slate-700 hover:bg-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-white/70 border border-white/80 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setViewport('desktop')}
              title="Desktop Preview"
              className={`p-1.5 rounded ${viewport === 'desktop' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              <Laptop className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewport('tablet')}
              title="Tablet Preview"
              className={`p-1.5 rounded ${viewport === 'tablet' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewport('mobile')}
              title="Mobile Preview"
              className={`p-1.5 rounded ${viewport === 'mobile' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowHistory((h) => !h)}
            className="px-3 py-2 text-xs font-semibold text-slate-800 bg-white/75 border border-slate-200 rounded-lg hover:bg-white flex items-center gap-1.5 whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5" /> Versions ({state.cmsHistory.length})
          </button>

          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-3 py-2 text-xs font-semibold text-slate-800 bg-white/75 border border-slate-200 rounded-lg hover:bg-white flex items-center gap-1.5 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" /> Save Draft
          </button>

          <button
            type="button"
            onClick={handlePublish}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-[#f28c28] rounded-lg hover:bg-[#e07d1b] flex items-center gap-1.5 whitespace-nowrap shadow-soft"
          >
            <UploadCloud className="w-3.5 h-3.5" /> Publish Live
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="bg-emerald-50/90 backdrop-blur-md border border-emerald-200 text-emerald-900 rounded-lg px-4 py-2.5 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" /> {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50/90 backdrop-blur-md border border-red-200 text-red-900 rounded-lg px-4 py-2.5 text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      {showHistory && (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Published Version History</h3>
          <div className="space-y-2">
            {state.cmsHistory.map((ver) => (
              <div
                key={ver.id}
                className="flex flex-wrap items-center justify-between gap-3 glass-panel rounded-lg px-4 py-2.5 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900">{ver.label}</span>
                  <span className="text-slate-500 ml-2">
                    · {ver.savedAt} by {ver.savedBy}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(ver.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-50/90 border border-amber-200 rounded hover:bg-amber-100 flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore Version
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Controls: Sections, Promotional Banner Upload & Manager, Global Theme */}
        <div className="xl:col-span-5 space-y-5">
          {/* Section Order & Add */}
          <div className="glass-card rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Page Sections ({activePage})</h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => addSection('featured_courses')}
                  className="px-2.5 py-1 text-xs font-semibold bg-white/75 hover:bg-white border border-slate-200 rounded flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3 h-3" /> Courses
                </button>
                <button
                  type="button"
                  onClick={() => addSection('promo_banner')}
                  className="px-2.5 py-1 text-xs font-semibold bg-white/75 hover:bg-white border border-slate-200 rounded flex items-center gap-1 whitespace-nowrap"
                >
                  <Plus className="w-3 h-3" /> Banner
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {sections.map((sec, idx) => (
                <div
                  key={sec.id}
                  className={`border rounded-lg p-3 flex items-center justify-between gap-2 ${
                    selectedSection?.id === sec.id ? 'border-amber-600 bg-amber-50/55' : 'border-slate-200/80 bg-white/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSectionId(sec.id)}
                    className="text-left min-w-0 flex-1"
                  >
                    <p className="text-xs font-bold text-slate-900 truncate">{sec.heading}</p>
                    <p className="text-[11px] text-slate-500">{sec.type.replace('_', ' ')}</p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveSection(idx, -1)}
                      className="p-1 text-slate-500 hover:text-slate-900"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(idx, 1)}
                      className="p-1 text-slate-500 hover:text-slate-900"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSection(sec.id, { visible: !sec.visible })}
                      className="p-1 text-slate-500 hover:text-slate-900"
                      title="Toggle Visibility"
                    >
                      {sec.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-red-500" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Section Editor */}
          {selectedSection && (
            <div className="glass-card rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Edit Section Content &amp; Styling</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Heading</label>
                <input
                  type="text"
                  value={selectedSection.heading}
                  onChange={(e) => updateSection(selectedSection.id, { heading: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Subheading</label>
                <input
                  type="text"
                  value={selectedSection.subheading}
                  onChange={(e) => updateSection(selectedSection.id, { subheading: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Body Copy</label>
                <textarea
                  rows={3}
                  value={selectedSection.bodyText}
                  onChange={(e) => updateSection(selectedSection.id, { bodyText: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Button Label</label>
                  <input
                    type="text"
                    value={selectedSection.ctaLabel}
                    onChange={(e) => updateSection(selectedSection.id, { ctaLabel: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Fallback Image Asset</label>
                  <select
                    value={selectedSection.imageUrl || ''}
                    onChange={(e) => updateSection(selectedSection.id, { imageUrl: e.target.value })}
                    className="w-full px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">No Image</option>
                    {mediaLibrary.map((img) => (
                      <option key={img.id} value={img.url}>
                        {img.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Background Colour</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedSection.backgroundColor}
                      onChange={(e) => updateSection(selectedSection.id, { backgroundColor: e.target.value })}
                      className="h-8 w-10 rounded border border-slate-300"
                    />
                    <span className="text-xs font-mono-tabular text-slate-600">{selectedSection.backgroundColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Text Colour</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedSection.textColor}
                      onChange={(e) => updateSection(selectedSection.id, { textColor: e.target.value })}
                      className="h-8 w-10 rounded border border-slate-300"
                    />
                    <span className="text-xs font-mono-tabular text-slate-600">{selectedSection.textColor}</span>
                  </div>
                </div>
              </div>

              {/* HERO PROMOTIONAL BANNER UPLOADER & SLIDE MANAGER */}
              {selectedSection.type === 'hero' && (
                <div className="pt-4 border-t border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Promotional Banner Slider ({(selectedSection.slides || []).length} slide
                        {(selectedSection.slides || []).length === 1 ? '' : 's'})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Upload banners, set action buttons, reorder, or toggle visibility.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const existing = selectedSection.slides || [];
                        const pick = mediaLibrary[existing.length % mediaLibrary.length];
                        const nextSlide: HeroSlide = {
                          id: `slide-${Date.now()}`,
                          imageUrl: pick?.url || FALLBACK_GALLERY[0].url,
                          divisionLabel: 'KWAN Academic Highlight',
                          title: 'New Promotional Banner',
                          caption: 'Promote term enrolment, workshops, or division programmes.',
                          ctaLabel: 'Get Started',
                          ctaTarget: 'get_started',
                          active: true,
                        };
                        updateSection(selectedSection.id, { slides: [...existing, nextSlide] });
                      }}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-amber-50/85 text-amber-950 border border-amber-200 rounded-lg hover:bg-amber-100 flex items-center gap-1 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Slide
                    </button>
                  </div>

                  {/* Playback Settings Row */}
                  <div className="grid grid-cols-2 gap-3 glass-panel rounded-lg p-3 text-xs">
                    <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSection.sliderAutoplay ?? true}
                        onChange={(e) => updateSection(selectedSection.id, { sliderAutoplay: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      Auto-Advance Slides
                    </label>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-slate-600">Speed</span>
                      <select
                        value={selectedSection.sliderIntervalSeconds ?? 5}
                        onChange={(e) =>
                          updateSection(selectedSection.id, { sliderIntervalSeconds: Number(e.target.value) })
                        }
                        className="px-2 py-1 border border-slate-300 rounded bg-white font-mono-tabular"
                      >
                        <option value={3}>3s</option>
                        <option value={5}>5s</option>
                        <option value={8}>8s</option>
                        <option value={12}>12s</option>
                      </select>
                    </div>
                  </div>

                  {/* Upload Promotional Banner Dropzone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) void handleUploadBannerFile(file);
                    }}
                    className={`border border-dashed rounded-xl p-4 space-y-3 transition-colors ${
                      dragActive ? 'border-amber-600 bg-amber-50/55' : 'border-slate-300/80 bg-white/55'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <ImagePlus className="w-4 h-4 text-amber-700" /> Upload Promotional Banner
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Drop an image here or upload PNG, JPG, WEBP, or SVG (max 8 MB).
                        </p>
                      </div>
                      <input
                        ref={mainUploadRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleUploadBannerFile(file);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        disabled={uploadingBanner}
                        onClick={() => mainUploadRef.current?.click()}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Upload className="w-3.5 h-3.5" /> {uploadingBanner ? 'Uploading...' : 'Upload Image'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={bannerLabelInput}
                      onChange={(e) => setBannerLabelInput(e.target.value)}
                      placeholder="Optional banner title before uploading (e.g. Term III Mock Clinics)"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  {/* CMS Media Library Strip */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-slate-700">
                      CMS Banner Media Library ({mediaLibrary.length}) — click to add slide
                    </p>
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                      {mediaLibrary.map((asset) => {
                        const isUploaded = asset.url.startsWith('/uploads/');
                        return (
                          <div
                            key={asset.id}
                            className="border border-slate-200 rounded-lg overflow-hidden bg-white flex flex-col"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                const existing = selectedSection.slides || [];
                                const newSlide: HeroSlide = {
                                  id: `slide-${Date.now()}`,
                                  imageUrl: asset.url,
                                  divisionLabel: 'Promotional Highlight',
                                  title: asset.label,
                                  caption: 'Featured KWAN academic campaign banner.',
                                  ctaLabel: 'Get Started',
                                  ctaTarget: 'get_started',
                                  active: true,
                                };
                                updateSection(selectedSection.id, { slides: [...existing, newSlide] });
                                notifyStatus(`Added "${asset.label}" as a hero banner.`);
                              }}
                              className="group text-left flex-1"
                              title={`Add "${asset.label}" to Hero Slider`}
                            >
                              <SafeImage
                                src={asset.url}
                                alt={asset.label}
                                className="w-full h-14 object-cover group-hover:opacity-90"
                              />
                              <p className="px-1.5 py-1 text-[10px] font-semibold text-slate-800 truncate">
                                {asset.label}
                              </p>
                            </button>
                            {isUploaded && (
                              <div className="px-1.5 pb-1 flex items-center justify-between text-[10px] text-slate-500">
                                <span className="tabular-nums">{asset.fileSizeKB || 0} KB</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMedia(asset.id, asset.url)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Delete uploaded file"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Individual Banner Slides Editor */}
                  <div className="space-y-3">
                    {(selectedSection.slides || []).map((slide, sIdx) => {
                      const slidesList = selectedSection.slides || [];
                      const isActive = slide.active !== false;
                      return (
                        <div
                          key={slide.id}
                          className={`border rounded-xl p-3 space-y-2.5 ${
                            isActive ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-slate-100/70 opacity-75'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <SafeImage
                                src={slide.imageUrl}
                                alt={slide.title || slide.divisionLabel}
                                className="w-12 h-8 object-cover rounded border border-slate-200 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">
                                  Banner {sIdx + 1} · {isActive ? 'Active' : 'Hidden'}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {slide.title || slide.divisionLabel}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => moveSlide(selectedSection.id, slidesList, sIdx, -1)}
                                className="p-1 text-slate-500 hover:text-slate-900"
                                title="Move Banner Up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveSlide(selectedSection.id, slidesList, sIdx, 1)}
                                className="p-1 text-slate-500 hover:text-slate-900"
                                title="Move Banner Down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSection(selectedSection.id, {
                                    slides: slidesList.map((s) =>
                                      s.id === slide.id ? { ...s, active: !isActive } : s
                                    ),
                                  })
                                }
                                className="p-1 text-slate-500 hover:text-slate-900"
                                title={isActive ? 'Hide Banner' : 'Activate Banner'}
                              >
                                {isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-amber-600" />}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSection(selectedSection.id, {
                                    slides: slidesList.filter((s) => s.id !== slide.id),
                                  })
                                }
                                className="p-1 text-red-600 hover:text-red-800"
                                title="Remove Banner"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <select
                              value={slide.imageUrl}
                              onChange={(e) =>
                                updateSection(selectedSection.id, {
                                  slides: slidesList.map((s) =>
                                    s.id === slide.id ? { ...s, imageUrl: e.target.value } : s
                                  ),
                                })
                              }
                              className="flex-1 px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                            >
                              {mediaLibrary.map((img) => (
                                <option key={img.id} value={img.url}>
                                  {img.label}
                                </option>
                              ))}
                            </select>
                            <label className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 cursor-pointer whitespace-nowrap">
                              Replace
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) void handleUploadBannerFile(file, slide.id);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={slide.divisionLabel}
                              onChange={(e) =>
                                updateSection(selectedSection.id, {
                                  slides: slidesList.map((s) =>
                                    s.id === slide.id ? { ...s, divisionLabel: e.target.value } : s
                                  ),
                                })
                              }
                              placeholder="Eyebrow tag"
                              className="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                            />
                            <input
                              type="text"
                              value={slide.title || ''}
                              onChange={(e) =>
                                updateSection(selectedSection.id, {
                                  slides: slidesList.map((s) =>
                                    s.id === slide.id ? { ...s, title: e.target.value } : s
                                  ),
                                })
                              }
                              placeholder="Banner headline"
                              className="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                            />
                          </div>

                          <input
                            type="text"
                            value={slide.caption}
                            onChange={(e) =>
                              updateSection(selectedSection.id, {
                                slides: slidesList.map((s) =>
                                  s.id === slide.id ? { ...s, caption: e.target.value } : s
                                ),
                              })
                            }
                            placeholder="Promotional caption"
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                          />

                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={slide.ctaLabel || ''}
                              onChange={(e) =>
                                updateSection(selectedSection.id, {
                                  slides: slidesList.map((s) =>
                                    s.id === slide.id ? { ...s, ctaLabel: e.target.value } : s
                                  ),
                                })
                              }
                              placeholder="CTA text (optional)"
                              className="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                            />
                            <select
                              value={slide.ctaTarget || 'get_started'}
                              onChange={(e) =>
                                updateSection(selectedSection.id, {
                                  slides: slidesList.map((s) =>
                                    s.id === slide.id
                                      ? { ...s, ctaTarget: e.target.value as PublicPageId }
                                      : s
                                  ),
                                })
                              }
                              className="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                            >
                              <option value="get_started">Get Started</option>
                              <option value="resources">Resources</option>
                              <option value="blog">Blog</option>
                              <option value="about">About Us</option>
                            </select>
                            <select
                              value={slide.divisionParam || ''}
                              onChange={(e) =>
                                updateSection(selectedSection.id, {
                                  slides: slidesList.map((s) =>
                                    s.id === slide.id
                                      ? { ...s, divisionParam: (e.target.value || undefined) as DivisionId | undefined }
                                      : s
                                  ),
                                })
                              }
                              className="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white"
                            >
                              <option value="">Any Division</option>
                              <option value="primary">Primary</option>
                              <option value="lower_secondary">Lower Sec</option>
                              <option value="upper_secondary">Upper Sec</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Global Theme, Typography, Footer */}
          <div className="glass-card rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Brand Theme, Fonts &amp; Footer</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Header &amp; Footer Light Blue</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.theme.primaryAccent}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, theme: { ...prev.theme, primaryAccent: e.target.value } }))
                    }
                    className="h-8 w-10 rounded border border-slate-300"
                  />
                  <span className="text-xs font-mono-tabular text-slate-600">{draft.theme.primaryAccent}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Secondary Accent (Sunrise)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.theme.secondaryAccent}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, theme: { ...prev.theme, secondaryAccent: e.target.value } }))
                    }
                    className="h-8 w-10 rounded border border-slate-300"
                  />
                  <span className="text-xs font-mono-tabular text-slate-600">{draft.theme.secondaryAccent}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Heading Font</label>
                <select
                  value={draft.theme.headingFont}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: {
                        ...prev.theme,
                        headingFont: e.target.value as WebsiteConfig['theme']['headingFont'],
                      },
                    }))
                  }
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white/80"
                >
                  <option value="Bricolage Grotesque">Bricolage Grotesque</option>
                  <option value="Outfit">Outfit</option>
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                  <option value="Fraunces">Fraunces Editorial</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Body Font</label>
                <select
                  value={draft.theme.bodyFont}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      theme: {
                        ...prev.theme,
                        bodyFont: e.target.value as WebsiteConfig['theme']['bodyFont'],
                      },
                    }))
                  }
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded bg-white/80"
                >
                  <option value="Figtree">Figtree</option>
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                  <option value="Outfit">Outfit</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Footer Tagline</label>
              <input
                type="text"
                value={draft.footer.tagline}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, footer: { ...prev.footer, tagline: e.target.value } }))
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Publish Version Note</label>
              <input
                type="text"
                value={publishLabel}
                onChange={(e) => setPublishLabel(e.target.value)}
                placeholder="e.g. Uploaded Term III Promotional Banners"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white/80"
              />
            </div>
          </div>
        </div>

        {/* Right Live Responsive Preview */}
        <div className="xl:col-span-7 bg-glass-canvas border border-white/80 rounded-2xl p-4 flex flex-col items-center shadow-glass">
          <div className="w-full flex items-center justify-between text-xs text-slate-600 mb-3 px-1">
            <span className="font-semibold text-slate-900">Live {viewport.toUpperCase()} Preview — {activePage}</span>
            <span>Core permissions &amp; payment security remain locked</span>
          </div>

          <div
            className="bg-glass-canvas border border-white/90 rounded-xl overflow-hidden shadow-lift transition-all duration-200"
            style={{
              width: viewport === 'desktop' ? '100%' : viewport === 'tablet' ? '768px' : '375px',
              maxWidth: '100%',
              fontFamily: draft.theme.bodyFont,
            }}
          >
            {/* Preview Top Bar (Light-Blue Glassmorphism) */}
            <div className="px-5 py-3 glass-header-footer border-b border-sky-200/70 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-gradient-brand text-slate-950 text-xs font-bold flex items-center justify-center border border-white/80">
                  K
                </span>
                <span className="text-base font-bold text-slate-950">{draft.brandName}</span>
              </div>
              {viewport !== 'mobile' && (
                <div className="flex items-center gap-4 text-xs font-medium text-slate-800">
                  {draft.navItems.map((n) => (
                    <span key={n.id} className="whitespace-nowrap">
                      {n.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Preview Sections */}
            <div className="divide-y divide-slate-200/70">
              {sections
                .filter((s) => s.visible)
                .map((sec) => (
                  <div
                    key={sec.id}
                    onClick={() => setSelectedSectionId(sec.id)}
                    className={`p-6 cursor-pointer transition-all backdrop-blur-md ${
                      selectedSection?.id === sec.id ? 'ring-2 ring-inset ring-amber-600' : ''
                    }`}
                    style={{
                      backgroundColor: sec.backgroundColor,
                      color: sec.textColor,
                    }}
                  >
                    <div
                      className={
                        (sec.imageUrl || (sec.slides && sec.slides.length > 0)) && viewport !== 'mobile'
                          ? 'grid grid-cols-12 gap-5 items-center'
                          : ''
                      }
                    >
                      <div
                        className={
                          (sec.imageUrl || (sec.slides && sec.slides.length > 0)) && viewport !== 'mobile'
                            ? 'col-span-6 space-y-2'
                            : 'space-y-2'
                        }
                      >
                        <h4
                          className="text-xl font-bold leading-tight"
                          style={{ fontFamily: draft.theme.headingFont }}
                        >
                          {sec.heading}
                        </h4>
                        <p className="text-xs opacity-85 font-medium">{sec.subheading}</p>
                        <p className="text-xs opacity-75 leading-relaxed">{sec.bodyText}</p>
                        <span
                          className={`inline-block mt-2 px-3.5 py-1.5 text-xs font-semibold text-slate-950 ${draft.theme.buttonStyle}`}
                          style={{
                            backgroundColor: draft.theme.secondaryAccent,
                          }}
                        >
                          {sec.ctaLabel}
                        </span>
                      </div>
                      {sec.slides && sec.slides.length > 0 ? (
                        <div className={viewport !== 'mobile' ? 'col-span-6' : 'mt-4'}>
                          <HeroImageSlider
                            slides={sec.slides}
                            fallbackAlt={sec.heading}
                            fallbackImageUrl={sec.imageUrl}
                            autoplay={sec.sliderAutoplay ?? true}
                            intervalSeconds={sec.sliderIntervalSeconds ?? 5}
                            primaryAccent={draft.theme.primaryAccent}
                            secondaryAccent={draft.theme.secondaryAccent}
                            compact
                          />
                        </div>
                      ) : (
                        sec.imageUrl && (
                          <div className={viewport !== 'mobile' ? 'col-span-6' : 'mt-4'}>
                            <SafeImage src={sec.imageUrl} alt={sec.heading} className="w-full h-36 object-cover rounded-lg" />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {/* Preview Footer (Light-Blue Glassmorphism) */}
            <div className="px-5 py-4 glass-header-footer border-t border-sky-200/70 text-slate-800 text-[11px] flex flex-wrap justify-between gap-2">
              <span className="font-medium">{draft.footer.tagline}</span>
              <span className="text-slate-950 font-semibold">{draft.footer.contactEmail}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
