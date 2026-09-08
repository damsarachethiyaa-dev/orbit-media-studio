'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Clock3,
  Download,
  Globe2,
  Layers3,
  Link2,
  Orbit,
  Settings2,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  Zap,
  LoaderCircle,
  CircleAlert,
  Laptop,
  X,
  BookOpen,
  Play,
  ArrowRight,
  Film,
} from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Batch,
  ErrorNotice,
  History,
  JobList,
  MediaResult,
  Studio,
} from '@/components/media-tools';
import {
  api,
  connectionDefault,
  detectSource,
  type Connection,
  type Job,
  type MediaInfo,
} from '@/lib/media';
import { registerMediaTools } from '@/lib/webmcp';
import {
  SpaceAtmosphere,
  Tutorial,
  LearningCenter,
} from '@/components/orbit-experience';
import {
  StudioNavigation,
  PlatformDock,
  PlatformIcon,
  MediaConstellation,
  WorkflowPanel,
  StudioTools,
} from '@/components/studio-shell';

export default function Home() {
  const [platformHint, setPlatformHint] = useState('');
  const [tutorial, setTutorial] = useState<string | null>(null);
  const [tab, setTab] = useState('video');
  const [link, setLink] = useState('');
  const [view, setView] = useState('download');
  const [dialog, setDialog] = useState<'settings' | 'help' | null>(null);
  const [connection, setConnection] = useState<Connection>(connectionDefault);
  const [draft, setDraft] = useState<Connection>(connectionDefault);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [checking, setChecking] = useState(false);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [motion, setMotion] = useState(true);
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const suppressAuto = useRef(false);
  const currentLink = useRef(link);
  currentLink.current = link;
  const analyzeController = useRef<AbortController | null>(null);
  const analysisNumber = useRef(0);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const source = detectSource(link);
  const activeJobs = jobs.filter((j) =>
    ['queued', 'processing'].includes(j.status),
  ).length;
  const viewTitle =
    view === 'learn'
      ? 'How to use'
      : view === 'studio'
        ? 'Watermark studio'
        : view === 'batch'
          ? 'Batch download'
          : view === 'history'
            ? 'Download history'
            : tab === 'audio'
              ? 'Audio extractor'
              : 'Smart downloader';
  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem('orbit-preferences') || 'null',
      );
      if (stored) {
        const c = {
          url: stored.url || connectionDefault.url,
          key: sessionStorage.getItem('orbit-key') || '',
        };
        setConnection(c);
        setDraft(c);
        setAutoAnalyze(stored.autoAnalyze !== false);
        setMotion(stored.motion !== false);
      }
    } catch {}
    setLoaded(true);
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = motion ? 'on' : 'off';
    if (loaded)
      try {
        localStorage.setItem(
          'orbit-preferences',
          JSON.stringify({ url: connection.url, autoAnalyze, motion }),
        );
        sessionStorage.setItem('orbit-key', connection.key);
      } catch {}
  }, [motion, autoAnalyze, connection, loaded]);
  const refresh = useCallback(async () => {
    try {
      const health = await api<{ ok: boolean }>(connection, '/health', {
        signal: AbortSignal.timeout(5000),
      });
      setConnected(health.ok);
      if (health.ok) setJobs(await api<Job[]>(connection, '/jobs'));
    } catch {
      setConnected(false);
    }
  }, [connection]);
  useEffect(() => {
    if (!loaded) return;
    void refresh();
    const timer = setInterval(() => void refresh(), activeJobs ? 2000 : 12000);
    return () => clearInterval(timer);
  }, [refresh, activeJobs, loaded]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  function navigate(next: string, audio = false) {
    setView(next);
    if (next === 'download') setTab(audio ? 'audio' : 'video');
    setError('');
    window.scrollTo({ top: 0, behavior: motion ? 'smooth' : 'auto' });
  }
  const onJob = useCallback(
    (job: Job) => {
      setJobs((j) => [job, ...j.filter((x) => x.id !== job.id)]);
      setNotice('Added to your download queue.');
      void refresh();
    },
    [refresh],
  );
  const analyze = useCallback(
    async (value: string) => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      analyzeController.current?.abort();
      const seq = ++analysisNumber.current;
      setError('');
      setInfo(null);
      if (!detectSource(value)) {
        setError('Paste a complete http or https video link.');
        setAnalyzing(false);
        return null;
      }
      const controller = new AbortController();
      analyzeController.current = controller;
      setAnalyzing(true);
      try {
        const result = await api<MediaInfo>(connection, '/analyze', {
          method: 'POST',
          body: JSON.stringify({ url: value.trim() }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(95000),
          ]),
        });
        if (seq === analysisNumber.current) {
          setInfo(result);
          setConnected(true);
        }
        return result;
      } catch (e) {
        if (seq === analysisNumber.current && !controller.signal.aborted)
          setError((e as Error).message);
        return null;
      } finally {
        if (seq === analysisNumber.current) setAnalyzing(false);
      }
    },
    [connection],
  );
  useEffect(() => {
    if (suppressAuto.current) {
      suppressAuto.current = false;
      return;
    }
    setInfo(null);
    setError('');
    analyzeController.current?.abort();
    analysisNumber.current++;
    setAnalyzing(false);
    if (autoAnalyze && link.trim() && detectSource(link))
      autoTimer.current = setTimeout(() => void analyze(link), 1000);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
  }, [link, autoAnalyze, analyze]);
  useEffect(() => () => analyzeController.current?.abort(), []);
  useEffect(
    () =>
      registerMediaTools({
        analyze: async (url) => {
          setView('download');
          if (url !== currentLink.current) {
            suppressAuto.current = true;
            setLink(url);
          }
          return analyze(url);
        },
        getJobs: () => jobs,
      }),
    [analyze, jobs],
  );
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setView('download');
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  async function paste() {
    try {
      setLink((await navigator.clipboard.readText()).trim());
    } catch {
      setError(
        'Clipboard access is unavailable. Paste into the link field with Ctrl+V or your device’s paste menu.',
      );
      inputRef.current?.focus();
    }
  }
  async function connect() {
    setChecking(true);
    setSettingsError('');
    try {
      const u = new URL(draft.url);
      if (
        !['http:', 'https:'].includes(u.protocol) ||
        u.username ||
        u.password ||
        u.search ||
        u.hash
      )
        throw new Error('Use a valid engine URL without embedded credentials.');
      const c = { url: draft.url.replace(/\/$/, ''), key: draft.key };
      const r = await api<{ ok: boolean }>(c, '/health', {
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok)
        throw new Error(
          'The engine is running but its media tools need setup.',
        );
      setConnection(c);
      setConnected(true);
      setNotice('Media engine connected.');
      setDialog(null);
    } catch (e) {
      setSettingsError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }
  function settings() {
    setDraft(connection);
    setSettingsError('');
    setDialog('settings');
  }

  function tryTool(target: string) {
    navigate(target === 'audio' ? 'download' : target, target === 'audio');
  }
  return (
    <SidebarProvider
      className="orbit-app orbit-professional"
      style={{ '--sidebar-width': '100px' } as React.CSSProperties}
    >
      <SpaceAtmosphere enabled={motion} />
      <StudioNavigation
        view={view}
        tab={tab}
        onNavigate={navigate}
        onSettings={settings}
        onHelp={() => setDialog('help')}
        activeJobs={activeJobs}
      />
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="mobile-toggle" />
            <span className="topbar-wordmark">
              orbit<span>STUDIO</span>
            </span>
            <span className="breadcrumb-separator">/</span>
            <strong>{viewTitle}</strong>
          </div>
          <div className="topbar-right">
            <button
              className="queue-top-button"
              onClick={() => navigate('history')}
            >
              <Clock3 size={15} />
              <span>My library</span>
              <b>{jobs.length}</b>
            </button>
            <span className="topbar-divider" />
            <button
              className="tour-top-button"
              onClick={() =>
                setTutorial(
                  view === 'studio'
                    ? 'watermark'
                    : view === 'batch'
                      ? 'batch'
                      : tab === 'audio'
                        ? 'audio'
                        : 'video',
                )
              }
            >
              <Play size={13} fill="currentColor" />
              <span>Quick tutorial</span>
            </button>
            <button
              className={
                'version-badge engine-status ' +
                (connected ? 'online' : 'offline')
              }
              onClick={settings}
            >
              <span className="status-dot" />
              <span>
                {connected
                  ? 'Connected'
                  : connected === null
                    ? 'Connecting…'
                    : 'Connect engine'}
              </span>
            </button>
          </div>
        </header>
        <main className="workspace">
          {view === 'download' && (
            <>
              <div className="workspace-intro">
                <div>
                  <div className="eyebrow">
                    <span /> THE CREATOR’S MEDIA WORKSPACE
                  </div>
                  <h1>
                    Create <span>your own orbit.</span>
                  </h1>
                  <p>Save videos. Find the sound. Perfect the frame.</p>
                </div>
                <MediaConstellation />
              </div>
              <div className="workbench-grid">
                <div className="workbench-column">
                  <section className="download-panel">
                    <div className="panel-heading">
                      <span className="panel-icon">
                        <Link2 size={21} />
                      </span>
                      <div>
                        <h2>
                          {tab === 'audio'
                            ? 'Extract your next soundtrack.'
                            : 'It starts with a link.'}
                        </h2>
                        <p>One field. Every available format.</p>
                      </div>
                      <span className="auto-badge">
                        <Sparkles size={12} />
                        SMART DETECTION
                      </span>
                    </div>
                    <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
                      <TabsList className="media-tabs download-mode-tabs">
                        <TabsTrigger value="video">
                          <Film />
                          Video download
                        </TabsTrigger>
                        <TabsTrigger value="audio">
                          <AudioLines />
                          Audio only
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <label
                      className="link-field-label"
                      htmlFor="orbit-video-link"
                    >
                      VIDEO LINK <span>Ctrl / ⌘ + K</span>
                    </label>
                    <form
                      className="link-field"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void analyze(link);
                      }}
                    >
                      <span className="input-platform-icon">
                        {source ? (
                          <PlatformIcon platform={source} size={21} />
                        ) : (
                          <Link2 size={21} />
                        )}
                      </span>
                      <input
                        id="orbit-video-link"
                        ref={inputRef}
                        type="url"
                        spellCheck={false}
                        autoComplete="off"
                        aria-label="Video link"
                        placeholder={
                          platformHint
                            ? `Paste a ${platformHint} video link…`
                            : 'Paste a video link from anywhere…'
                        }
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                      />
                      <button
                        type="button"
                        className="paste-button"
                        onClick={paste}
                      >
                        <Clipboard size={15} />
                        <span>Paste</span>
                      </button>
                    </form>
                    <div className="download-actions">
                      <div className="detection-feedback">
                        {source ? (
                          <>
                            <Check size={14} />
                            <span>{source} recognized</span>
                          </>
                        ) : (
                          <>
                            <Globe2 size={14} />
                            <span>We’ll recognize the source for you</span>
                          </>
                        )}
                      </div>
                      <button
                        className="primary-button analyze-button"
                        onClick={() => void analyze(link)}
                        disabled={analyzing}
                      >
                        {analyzing ? (
                          <LoaderCircle size={17} className="spin" />
                        ) : (
                          <Sparkles size={17} />
                        )}{' '}
                        {analyzing ? 'Finding your video…' : 'Find my video'}
                        <ArrowRight size={17} />
                      </button>
                    </div>
                    {analyzing && (
                      <div className="analyzing-state" role="status">
                        <span className="scan-line" />
                        <LoaderCircle size={16} className="spin" />
                        Discovering available formats on {source}…
                      </div>
                    )}
                    {error && <ErrorNotice message={error} />}{' '}
                    {info && (
                      <MediaResult
                        key={info.id}
                        info={info}
                        kind={tab}
                        connection={connection}
                        onJob={onJob}
                      />
                    )}
                    <div className="download-panel-foot">
                      <span>
                        <ShieldCheck size={13} />
                        Use media you own or have permission to download.
                      </span>
                      <span>
                        <Check size={13} />
                        Source quality
                      </span>
                    </div>
                  </section>
                  <PlatformDock
                    selected={platformHint}
                    onSelect={(name) => {
                      setPlatformHint(name);
                      inputRef.current?.focus();
                    }}
                  />
                </div>
                <WorkflowPanel
                  connected={connected}
                  active={activeJobs}
                  completed={
                    jobs.filter((j) => j.status === 'completed').length
                  }
                  onTutorial={() =>
                    setTutorial(tab === 'audio' ? 'audio' : 'video')
                  }
                  onSettings={settings}
                  onHistory={() => navigate('history')}
                />
              </div>
              <div className="section-label tools-section-title">
                <div>
                  <span className="section-kicker">
                    A LITTLE EXTRA CREATIVE POWER
                  </span>
                  <h2>Go beyond the download.</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate('learn')}
                >
                  Explore the guides <ArrowUpRight size={15} />
                </button>
              </div>
              <StudioTools onNavigate={navigate} />
              <div className="section-label recent-heading">
                <div>
                  <span className="section-kicker">
                    YOUR WORK, WITHIN REACH
                  </span>
                  <h2>
                    Recent activity{' '}
                    <span className="count-badge">{jobs.length}</span>
                  </h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate('history')}
                >
                  Open library <ArrowRight size={15} />
                </button>
              </div>
              {jobs.length ? (
                <JobList
                  compact
                  jobs={jobs}
                  connection={connection}
                  onRefresh={refresh}
                />
              ) : (
                <div className="empty-activity">
                  <span className="empty-icon">
                    <ArrowDownToLine size={24} />
                  </span>
                  <div>
                    Your library starts with a little inspiration.
                    <p>
                      Add a video link above. Your downloads will find their
                      home here.
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => setTutorial('video')}
                  >
                    Take the first step <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
          {view === 'studio' && (
            <Studio connection={connection} onJob={onJob} />
          )}{' '}
          {view === 'batch' && <Batch connection={connection} onJob={onJob} />}{' '}
          {view === 'history' && (
            <History jobs={jobs} connection={connection} onRefresh={refresh} />
          )}{' '}
          {view === 'learn' && (
            <LearningCenter
              onTutorial={setTutorial}
              onTry={tryTool}
              onSettings={settings}
            />
          )}
          <footer className="workspace-footer">
            <span>
              <Orbit size={15} />
              Orbit Media Studio<span className="footer-dot">·</span>Made for
              your creative flow.
            </span>
            <button onClick={() => navigate('learn')}>
              <BookOpen size={14} />
              How to use Orbit
              <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>
      </div>
      <Tutorial
        open={tutorial !== null}
        initialLesson={tutorial || 'video'}
        onOpenChange={(open) => {
          if (!open) setTutorial(null);
        }}
        onTry={tryTool}
      />
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="orbit-dialog">
          <DialogHeader>
            <DialogTitle>
              {dialog === 'settings'
                ? 'Make Orbit your own.'
                : 'A little guidance for your orbit.'}
            </DialogTitle>
            <DialogDescription>
              {dialog === 'settings'
                ? 'Connect your media engine and set your workspace preferences.'
                : 'A few things to help you keep your creative flow.'}
            </DialogDescription>
          </DialogHeader>
          {dialog === 'settings' ? (
            <>
              <div className="setting-row">
                <div>
                  <strong>Automatic link analysis</strong>
                  <p>Find available formats when you paste a link.</p>
                </div>
                <Switch
                  aria-label="Automatic link analysis"
                  checked={autoAnalyze}
                  onCheckedChange={setAutoAnalyze}
                />
              </div>
              <div className="setting-row">
                <div>
                  <strong>Cosmic motion</strong>
                  <p>Floating orbits and animated transitions.</p>
                </div>
                <Switch
                  aria-label="Cosmic motion"
                  checked={motion}
                  onCheckedChange={setMotion}
                />
              </div>
              <div className="settings-divider" />
              <label className="field-label" htmlFor="engine-url">
                Media engine URL
              </label>
              <input
                id="engine-url"
                className="settings-input"
                value={draft.url}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, url: e.target.value }))
                }
                placeholder="http://127.0.0.1:4318"
              />
              <label className="field-label" htmlFor="engine-key">
                Engine key <span>· if configured</span>
              </label>
              <input
                id="engine-key"
                type="password"
                className="settings-input"
                value={draft.key}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, key: e.target.value }))
                }
                autoComplete="off"
              />
              <p className="tool-footnote">
                The media engine handles downloads and video processing. Use the
                engine running on your computer, or connect your own hosted
                engine. Your key stays in this browser session.
              </p>
              {settingsError && <ErrorNotice message={settingsError} />}
              <button
                className="primary-button"
                onClick={connect}
                disabled={checking}
              >
                {checking ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Zap size={16} />
                )}{' '}
                {checking ? 'Connecting…' : 'Save & connect'}
              </button>
              <p className="install-tip">
                <Laptop size={16} />
                Install Orbit using your browser’s “Install app” or “Add to Home
                Screen” menu.
              </p>
            </>
          ) : (
            <div className="help-content">
              <button
                className="primary-button"
                onClick={() => {
                  setDialog(null);
                  navigate('learn');
                }}
              >
                <BookOpen size={16} />
                Open tutorials & how-to guides
                <ArrowRight size={16} />
              </button>
              <h3>One link, your choice.</h3>
              <p>
                Paste a public video link. Orbit recognizes the source and asks
                your connected engine for available formats. Choose video
                quality or MP3, then add it to the queue. Save the finished file
                from Download history.
              </p>
              <h3>Clean up a watermark.</h3>
              <p>
                Upload a video you own, drag a box around a static watermark,
                and choose blending or blur. The edit applies to every frame.
                Moving watermarks and detailed backgrounds may need a dedicated
                editor.
              </p>
              <h3>Keep your engine connected.</h3>
              <p>
                Video processing runs in the companion media engine. The hosted
                website needs that engine to be reachable and to allow this
                site’s address. If your browser blocks a local connection, use
                the local app or an HTTPS engine.
              </p>
              <h3>What can I download?</h3>
              <p>
                Public media supported by the source extractor. Private,
                protected, live, or unavailable videos may not work. Only
                process media you own or have permission to use.
              </p>
              <div className="shortcut-row">
                <span>Jump to link field</span>
                <kbd>Ctrl / ⌘ + K</kbd>
              </div>
              <div className="shortcut-row">
                <span>Analyze link</span>
                <kbd>Enter</kbd>
              </div>
              <div className="shortcut-row">
                <span>Close this window</span>
                <kbd>Esc</kbd>
              </div>
              <p className="help-credit">
                Media engine powered by{' '}
                <a
                  href="https://github.com/yt-dlp/yt-dlp"
                  target="_blank"
                  rel="noreferrer"
                >
                  yt-dlp
                </a>{' '}
                and{' '}
                <a
                  href="https://ffmpeg.org/ffmpeg-filters.html#delogo"
                  target="_blank"
                  rel="noreferrer"
                >
                  FFmpeg
                </a>
                .
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {notice && (
        <div className="toast-notice" role="status">
          <Check size={17} />
          <span>{notice}</span>
          <button
            onClick={() => {
              setNotice('');
              navigate('history');
            }}
          >
            View queue <ArrowUpRight size={14} />
          </button>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </SidebarProvider>
  );
}
