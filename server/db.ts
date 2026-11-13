import fs from 'node:fs';
import path from 'node:path';
import type { PlatformState } from '../src/types/kwan.ts';
import { createSeedData } from './seedData.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'kwan-db.json');

let memoryCache: PlatformState | null = null;

export function getDb(): PlatformState {
  if (memoryCache) return memoryCache;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as PlatformState;
      const seeded = createSeedData();
      const rawRecord = parsed as unknown as Record<string, unknown>;
      let mutated = false;

      if ('certificates' in rawRecord || 'certificateTemplates' in rawRecord) {
        delete rawRecord.certificates;
        delete rawRecord.certificateTemplates;
        mutated = true;
      }

      const rawSettings = parsed.settings as unknown as Record<string, unknown> | undefined;
      if (rawSettings && 'nationalExamDisclaimer' in rawSettings) {
        delete rawSettings.nationalExamDisclaimer;
        mutated = true;
      }

      const sanitizeWebsiteConfig = (cfg: typeof parsed.cmsPublished | undefined) => {
        if (!cfg) return;
        if (
          cfg.theme &&
          (cfg.theme.primaryAccent === '#0F4C81' || cfg.theme.primaryAccent === '#13568c')
        ) {
          cfg.theme.primaryAccent = '#bae6fd';
          cfg.theme.secondaryAccent = '#f28c28';
          cfg.theme.headingFont = 'Bricolage Grotesque';
          cfg.theme.bodyFont = 'Figtree';
          mutated = true;
        }
        if (!cfg.pages) return;
        for (const pageKey of Object.keys(cfg.pages) as Array<keyof typeof cfg.pages>) {
          const sections = cfg.pages[pageKey];
          if (!Array.isArray(sections)) continue;
          for (const sec of sections) {
            const bg = (sec.backgroundColor || '').toLowerCase();
            if (
              bg === '#0b2545' ||
              bg === '#0f172a' ||
              bg === '#f8fafc' ||
              bg === '#f4f7fb' ||
              bg === '#ffffff'
            ) {
              sec.backgroundColor = '#f6f5f0';
              sec.textColor = '#0f172a';
              mutated = true;
            }
            if ((sec.ctaTarget as string) === 'verify') {
              sec.ctaTarget = 'get_started';
              sec.ctaLabel = 'Get Started Today';
              sec.bodyText =
                'Enrol through your KWAN student account to access interactive lessons, practice quizzes, and detailed tutor feedback.';
              mutated = true;
            }
            if (sec.id === 'about-hero' && sec.bodyText.includes('certificate')) {
              sec.bodyText =
                'A Primary 5 pupil should never navigate the same interface as an S.6 Physics and Mathematics candidate. KWAN separates the learning interface, assessment format, and progression benchmarks for each division while uniting families, tutors, and administrators.';
              mutated = true;
            }
            if (sec.id === 'about-pillars' && (sec.subheading.includes('certification') || sec.bodyText.includes('certificate'))) {
              sec.subheading = 'Curriculum alignment, rigorous tutor feedback, and visual progress tracking.';
              sec.bodyText =
                'KWAN combines age-authentic digital classrooms with live course completion analytics and tutor-marked feedback across every division.';
              mutated = true;
            }
            if (sec.id === 'gs-hero' && sec.bodyText.includes('certificate')) {
              sec.bodyText =
                'Your account connects directly to the right learning environment, permitted courses, and personalised progress dashboard.';
              mutated = true;
            }
            if (Array.isArray(sec.slides)) {
              for (const slide of sec.slides) {
                if ((slide.ctaTarget as string) === 'verify') {
                  slide.ctaTarget = 'get_started';
                  mutated = true;
                }
              }
            }
          }
        }
      };

      sanitizeWebsiteConfig(parsed.cmsPublished);
      sanitizeWebsiteConfig(parsed.cmsDraft);
      if (Array.isArray(parsed.cmsHistory)) {
        for (const snap of parsed.cmsHistory) {
          sanitizeWebsiteConfig(snap.config);
        }
      }

      const defaultSlides = seeded.cmsPublished.pages.home[0]?.slides;
      if (defaultSlides) {
        const pubHero = parsed.cmsPublished?.pages?.home?.find((s) => s.id === 'home-hero');
        const draftHero = parsed.cmsDraft?.pages?.home?.find((s) => s.id === 'home-hero');
        if (pubHero && (!pubHero.slides || pubHero.slides.length === 0)) {
          pubHero.slides = defaultSlides;
        }
        if (draftHero && (!draftHero.slides || draftHero.slides.length === 0)) {
          draftHero.slides = defaultSlides;
        }
        if (pubHero && pubHero.sliderAutoplay === undefined) {
          pubHero.sliderAutoplay = true;
          pubHero.sliderIntervalSeconds = 5;
        }
        if (draftHero && draftHero.sliderAutoplay === undefined) {
          draftHero.sliderAutoplay = true;
          draftHero.sliderIntervalSeconds = 5;
        }
      }
      if (!parsed.cmsMedia || parsed.cmsMedia.length === 0) {
        parsed.cmsMedia = seeded.cmsMedia;
      }
      if (!Array.isArray(parsed.forumThreads)) {
        parsed.forumThreads = seeded.forumThreads;
        mutated = true;
      }
      if (mutated) {
        saveDb(parsed);
      }
      memoryCache = parsed;
      return memoryCache;
    } catch {
      // Fallback to fresh seed if corrupted
    }
  }

  const seeded = createSeedData();
  saveDb(seeded);
  return seeded;
}

export function saveDb(next: PlatformState): PlatformState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  memoryCache = next;
  fs.writeFileSync(DB_PATH, JSON.stringify(next, null, 2), 'utf-8');
  return memoryCache;
}
