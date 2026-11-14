import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { Pool, type PoolClient } from '@neondatabase/serverless';
import type { PlatformState } from '../src/types/kwan.ts';
import { createSeedData } from './seedData.ts';
import { hashPassword, isPasswordHash } from './auth.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'kwan-db.json');
const STATE_TABLE = 'kwan_platform_state';

let memoryCache: PlatformState | null = null;
let pool: Pool | undefined;

interface DatabaseRequestContext {
  client: PoolClient;
  state: PlatformState;
  dirty: boolean;
  finished: boolean;
  finalizing?: Promise<void>;
}

const requestContext = new AsyncLocalStorage<DatabaseRequestContext>();

function isVercelRuntime(): boolean {
  return process.env.VERCEL === '1';
}

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be configured for Vercel deployments.');
  }
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 5_000,
  });
  return pool;
}

async function finalizeRequest(context: DatabaseRequestContext, commit: boolean): Promise<void> {
  if (context.finalizing) return context.finalizing;
  if (context.finished) return;

  context.finalizing = (async () => {
    try {
      if (commit && context.dirty) {
        await context.client.query(
          `INSERT INTO ${STATE_TABLE} (id, state, updated_at)
           VALUES (1, $1::jsonb, now())
           ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
          [JSON.stringify(context.state)]
        );
      }
      await context.client.query(commit ? 'COMMIT' : 'ROLLBACK');
    } catch (error) {
      try {
        await context.client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Unable to roll back the platform state transaction.', rollbackError);
      }
      throw error;
    } finally {
      context.finished = true;
      context.client.release();
    }
  })();
  return context.finalizing;
}

export async function persistDbRequest(): Promise<void> {
  const context = requestContext.getStore();
  if (context) await finalizeRequest(context, true);
}

export const databaseMiddleware: RequestHandler = (req, res, next) => {
  if (!process.env.DATABASE_URL) {
    if (isVercelRuntime()) {
      res.status(503).json({ error: 'Connect a Postgres database and set DATABASE_URL in Vercel.' });
      return;
    }
    next();
    return;
  }

  void (async () => {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(80421377)');
      await client.query(
        `CREATE TABLE IF NOT EXISTS ${STATE_TABLE} (
          id smallint PRIMARY KEY CHECK (id = 1),
          state jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )`
      );
      const result = await client.query<{ state: PlatformState }>(
        `SELECT state FROM ${STATE_TABLE} WHERE id = 1 FOR UPDATE`
      );
      const context: DatabaseRequestContext = {
        client,
        state: result.rows[0]?.state ?? getDb(),
        dirty: result.rows.length === 0,
        finished: false,
      };

      requestContext.run(context, () => {
        const json = res.json.bind(res);
        let responseStarted = false;
        res.json = ((body: unknown) => {
          if (responseStarted) return res;
          responseStarted = true;
          void finalizeRequest(context, res.statusCode < 400)
            .then(() => json(body))
            .catch((error: unknown) => {
              console.error('Unable to persist platform state.', error);
              if (!res.headersSent) {
                res.status(500);
                json({ error: 'Unable to persist platform state. Please try again.' });
              } else {
                res.destroy(error instanceof Error ? error : new Error(String(error)));
              }
            });
          return res;
        }) as typeof res.json;

        res.once('close', () => {
          if (!context.finished && !responseStarted) {
            void finalizeRequest(context, false).catch((error: unknown) => {
              console.error('Unable to release the platform state transaction.', error);
            });
          }
        });
        next();
      });
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Unable to roll back a failed platform state request.', rollbackError);
      }
      client.release();
      next(error);
    }
  })().catch(next);
};

export function getDb(): PlatformState {
  const context = requestContext.getStore();
  if (context) return context.state;
  if (memoryCache) return memoryCache;

  if (!isVercelRuntime() && !fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as PlatformState;
      const seeded = createSeedData();
      const rawRecord = parsed as unknown as Record<string, unknown>;
      let mutated = false;

      for (const user of parsed.users || []) {
        if (user.role === 'admin') {
          if (user.name !== 'Ayen Geoffrey Alexander') {
            user.name = 'Ayen Geoffrey Alexander';
            mutated = true;
          }
          if (user.password === 'kwan') {
            user.password = '';
            mutated = true;
          }
        }
        if (user.password && !isPasswordHash(user.password)) {
          user.password = hashPassword(user.password);
          mutated = true;
        }
      }

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
        if (cfg.theme?.primaryAccent === '#bae6fd' && cfg.theme.secondaryAccent === '#f28c28') {
          cfg.theme.primaryAccent = '#0F4C81';
          cfg.theme.secondaryAccent = '#10B981';
          mutated = true;
        }
        if (!cfg.pages) return;
        for (const pageKey of Object.keys(cfg.pages) as Array<keyof typeof cfg.pages>) {
          const sections = cfg.pages[pageKey];
          if (!Array.isArray(sections)) continue;
          for (const sec of sections) {
            const bg = (sec.backgroundColor || '').toLowerCase();
            if (
              bg === '#f6f5f0' ||
              bg === '#0b2545' ||
              bg === '#0f172a' ||
              bg === '#f8fafc' ||
              bg === '#f4f7fb' ||
              bg === '#ffffff'
            ) {
              sec.backgroundColor = '#F4F7F6';
              sec.textColor = '#0A2540';
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
  const context = requestContext.getStore();
  if (context) {
    context.state = next;
    context.dirty = true;
    return next;
  }

  memoryCache = next;
  if (isVercelRuntime()) return next;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(next, null, 2), 'utf-8');
  return memoryCache;
}
