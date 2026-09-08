'use client';
// SpaceAtmosphere: the fixed-position canvas starfield behind the whole app.
// Tutorial: the step-by-step "how this tool works" dialog with mocked-up
// demo screens (opened from "Quick tutorial" and the tool cards).
// LearningCenter: the full-page "Learn" view with lesson cards and tips.
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Film,
  Layers3,
  Link2,
  MousePointer2,
  Orbit,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function SpaceAtmosphere({ enabled }: { enabled: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const context = el.getContext('2d');
    if (!context) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      last = 0,
      time = 0,
      w = 0,
      h = 0;
    let pointer = { x: 0, y: 0 };
    const stars = Array.from({ length: 96 }, (_, i) => ({
      x: ((i * 73.71 + 19) % 100) / 100,
      y: ((i * 31.39 + 7) % 100) / 100,
      r: 0.45 + (i % 4) * 0.35,
      s: 0.12 + (i % 7) * 0.035,
      cyan: i % 3 === 0,
    }));
    function resize() {
      w = innerWidth;
      h = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 1.25);
      el!.width = w * dpr;
      el!.height = h * dpr;
      el!.style.width = w + 'px';
      el!.style.height = h + 'px';
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function draw() {
      context!.clearRect(0, 0, w, h);
      // Stars are batched into two paths (one per color) and filled once
      // each, instead of once per star, so adding more stars costs almost
      // nothing extra -- the expensive part is the fill() call, not the
      // per-star position math.
      const cyanPath = new Path2D();
      const grayPath = new Path2D();
      for (const [i, star] of stars.entries()) {
        const x =
          (star.x * w +
            Math.sin(time * star.s + i) * 11 +
            pointer.x * star.r * 4 +
            w) %
          w;
        const y =
          (((star.y * h - time * star.s * 3 + pointer.y * star.r * 4) % h) +
            h) %
          h;
        const path = star.cyan ? cyanPath : grayPath;
        path.moveTo(x + star.r, y);
        path.arc(x, y, star.r, 0, Math.PI * 2);
      }
      const alphaA = 0.26 + (Math.sin(time * 0.6) * 0.5 + 0.5) * 0.3;
      const alphaB = 0.22 + (Math.sin(time * 0.6 + 2) * 0.5 + 0.5) * 0.26;
      context!.fillStyle = `rgba(91,209,222,${alphaA})`;
      context!.fill(cyanPath);
      context!.fillStyle = `rgba(165,184,211,${alphaB})`;
      context!.fill(grayPath);
    }
    function tick(now: number) {
      if (now - last > 40) {
        time += Math.min((now - last) / 1000, 0.06);
        last = now;
        draw();
      }
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame);
      last = performance.now();
      if (enabled && !media.matches && !document.hidden)
        frame = requestAnimationFrame(tick);
      else {
        pointer = { x: 0, y: 0 };
        draw();
      }
    }
    function move(e: PointerEvent) {
      if (enabled && !media.matches) {
        pointer = { x: e.clientX / w - 0.5, y: e.clientY / h - 0.5 };
      }
    }
    resize();
    sync();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('visibilitychange', sync);
    media.addEventListener('change', sync);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('visibilitychange', sync);
      media.removeEventListener('change', sync);
    };
  }, [enabled]);
  return (
    <div className="space-atmosphere" aria-hidden="true">
      <div className="aurora-light aurora-violet" />
      <div className="aurora-light aurora-cyan" />
      <canvas ref={canvas} />
      <span className="shooting-star meteor-one" />
      <span className="shooting-star meteor-two" />
    </div>
  );
}

export const lessons = [
  {
    id: 'video',
    icon: Film,
    label: 'Download video',
    title: 'From link to your library.',
    description: 'Your first download, in four simple steps.',
    destination: 'download',
    steps: [
      {
        title: 'Connect your media engine',
        body: 'Start Orbit on your computer using Start-Orbit.cmd. Look for “Engine connected” at the top of the workspace. If it is disconnected, open Preferences and choose Save & connect.',
        action: 'Engine is connected',
        hint: 'The local engine creates the video files. Keep its launch window open.',
      },
      {
        title: 'Paste a video link',
        body: 'Copy a public video link and paste it into the main link field. Orbit identifies the source automatically. Select Find my video if automatic analysis is turned off.',
        action: 'Paste a sample link',
        hint: 'Ctrl / ⌘ + K jumps to the link field. Ctrl / ⌘ + V pastes your link.',
      },
      {
        title: 'Choose your format',
        body: 'Choose Video and select a quality from the formats returned by the source. Best available picks the highest available source quality. Select Add to downloads to begin.',
        action: 'Choose quality & add',
        hint: '4K appears only when the source actually offers it. MP4 output includes available audio.',
      },
      {
        title: 'Save the finished file',
        body: 'Open Download history and wait for Completed. Click the download icon beside the video to save the file to your device.',
        action: 'Finish tutorial',
        hint: 'The browser saves the file. A completed queue item is ready for you to download.',
      },
    ],
  },
  {
    id: 'audio',
    icon: AudioLines,
    label: 'Extract audio',
    title: 'Keep just the sound.',
    description: 'Turn the audio in your video into an MP3.',
    destination: 'audio',
    steps: [
      {
        title: 'Open Audio extractor',
        body: 'Choose Audio extractor in the sidebar, or switch the main downloader to Audio only. Make sure your media engine is connected.',
        action: 'Select audio mode',
        hint: 'You can use the same video link for video and audio downloads.',
      },
      {
        title: 'Paste and identify your video',
        body: 'Paste a public video link. Orbit asks the source for available media and checks whether an audio stream is listed.',
        action: 'Paste a sample link',
        hint: 'A silent video cannot produce an audio track. Some direct links do not declare audio details.',
      },
      {
        title: 'Add your MP3 to the queue',
        body: 'Select Add to downloads. Your engine downloads the audio and converts it to a 192 kbps MP3.',
        action: 'Add MP3 to downloads',
        hint: 'Conversion happens after the source download. Leave the engine running.',
      },
      {
        title: 'Take the sound with you',
        body: 'Go to Download history. When the item shows Completed, click its download icon to save your MP3.',
        action: 'Finish tutorial',
        hint: 'Use the search field to quickly find an earlier audio download.',
      },
    ],
  },
  {
    id: 'watermark',
    icon: WandSparkles,
    label: 'Clean a watermark',
    title: 'A little cleanup. A fresh frame.',
    description: 'Learn how to select and edit a static watermark.',
    destination: 'studio',
    steps: [
      {
        title: 'Choose your own video',
        body: 'Open Watermark studio, then drag in a video or choose a file. MP4, MOV, and WebM are supported, up to 512 MB.',
        action: 'Choose a sample video',
        hint: 'Use a video you own or have permission to edit. Keep the engine connected.',
      },
      {
        title: 'Select the watermark',
        body: 'Drag a box around the watermark in the video preview. Use Left, Top, Width, and Height to adjust the selection precisely. Keep a small margin inside the frame edges.',
        action: 'Select the watermark',
        hint: 'The selected rectangle stays in the same position throughout the video.',
      },
      {
        title: 'Choose how to clean it',
        body: 'Blend surrounding pixels works best on small marks over simple backgrounds. Choose Soft blur when you prefer to obscure the selected area.',
        action: 'Choose blend or blur',
        hint: 'Blending approximates the background. It cannot recover pixels hidden behind a watermark.',
      },
      {
        title: 'Export and review',
        body: 'Choose Clean & export MP4, then open Download history and save the completed video. Review the result to see if the selection needs adjusting.',
        action: 'Finish tutorial',
        hint: 'The edit applies to every frame, and available audio is preserved.',
      },
    ],
  },
  {
    id: 'batch',
    icon: Layers3,
    label: 'Download a batch',
    title: 'Give every link a place.',
    description: 'Queue multiple videos without repeating the same steps.',
    destination: 'batch',
    steps: [
      {
        title: 'Gather your video links',
        body: 'Open Batch download. Paste one individual video link per line, with up to 10 links in a batch.',
        action: 'Add sample links',
        hint: 'Duplicate links are skipped. Use individual videos rather than a playlist URL.',
      },
      {
        title: 'Choose one output format',
        body: 'Select MP4 for video or MP3 for audio. The chosen format applies to every video in this batch.',
        action: 'Choose batch format',
        hint: 'Video batches use the best quality available from each source.',
      },
      {
        title: 'Start your batch',
        body: 'Select Download batch. Orbit analyzes each link and adds supported videos to the queue. Two jobs process at a time.',
        action: 'Queue the batch',
        hint: 'If one link fails, you can read its error while the remaining links continue.',
      },
      {
        title: 'Save your finished downloads',
        body: 'Visit Download history and save each completed file. You can cancel an active job or remove an older completed file from its row.',
        action: 'Finish tutorial',
        hint: 'Stop adding stops new items entering the queue; already queued jobs keep running.',
      },
    ],
  },
];
type Lesson = (typeof lessons)[number];

function Demo({ lesson, step }: { lesson: Lesson; step: number }) {
  const Icon = lesson.icon;
  const isWatermark = lesson.id === 'watermark';
  return (
    <div
      className="tutorial-demo"
      data-lesson={lesson.id}
      data-step={step}
      key={lesson.id + '-' + step}
      aria-label={`Illustration of step ${step + 1}: ${lesson.steps[step].title}`}
    >
      <div className="demo-chrome">
        <span />
        <span />
        <span />
        <span className="demo-caption">ORBIT / INTERACTIVE DEMO</span>
      </div>
      <div className="demo-body">
        <div className="demo-brand">
          <Orbit size={18} /> orbit<span>Practice mode</span>
        </div>
        {step === 0 ? (
          <div className="demo-connect">
            <div className="demo-orbits">
              <span />
              <span />
              <Icon size={38} />
            </div>
            <strong>
              {isWatermark
                ? 'Your video, ready to edit.'
                : lesson.id === 'batch'
                  ? 'A place for every link.'
                  : 'You’re connected.'}
            </strong>
            <span className="demo-status">
              <i />{' '}
              {isWatermark
                ? 'my-video.mp4 · sample'
                : lesson.id === 'batch'
                  ? '3 sample links ready'
                  : 'Media engine online · example'}
            </span>
          </div>
        ) : step === 1 ? (
          <>
            <div className="demo-label">
              {isWatermark
                ? 'SELECT YOUR WATERMARK'
                : 'YOUR VIDEO LINK' + (lesson.id === 'batch' ? 'S' : '')}
            </div>
            {isWatermark ? (
              <div className="watermark-demo-frame">
                <Film size={40} />
                <div className="demo-watermark">
                  watermark
                  <span />
                </div>
                <MousePointer2 className="demo-cursor" />
              </div>
            ) : (
              <>
                <div className="demo-input">
                  <Link2 size={16} />
                  <span>
                    {lesson.id === 'batch'
                      ? '3 links · one per line'
                      : 'https://video.example/my-video'}
                  </span>
                  <span className="demo-caret" />
                </div>
                <div className="demo-detected">
                  <Check size={14} />{' '}
                  {lesson.id === 'batch'
                    ? 'MP4 · Best available selected'
                    : 'Source recognized'}
                </div>
                <MousePointer2 className="demo-cursor" />
              </>
            )}
          </>
        ) : step === 2 ? (
          <>
            <div className="demo-label">
              {isWatermark ? 'CHOOSE YOUR CLEANUP' : 'YOUR DOWNLOAD OPTIONS'}
            </div>
            <div className="demo-choice selected">
              <span>
                <Check size={15} />
                {isWatermark
                  ? 'Blend surrounding pixels'
                  : lesson.id === 'audio'
                    ? 'MP3 · 192 kbps'
                    : 'MP4 · Best available'}
              </span>
              <span className="demo-tag">SELECTED</span>
            </div>
            <div className="demo-choice">
              {isWatermark
                ? 'Soft blur'
                : lesson.id === 'audio'
                  ? 'Audio only'
                  : 'Available source quality'}
            </div>
            <div className="demo-button">
              <Icon size={16} />
              {isWatermark ? 'Clean & export MP4' : 'Add to downloads'}
              <ArrowRight size={16} />
            </div>
          </>
        ) : (
          <div className="demo-finish">
            <span className="demo-complete">
              <Check size={34} />
            </span>
            <strong>
              {isWatermark
                ? 'Your fresh frame is ready.'
                : 'Ready for a second play.'}
            </strong>
            <div className="demo-job">
              <Icon size={22} />
              <div>
                My {isWatermark ? 'cleaned ' : ''}
                {lesson.id === 'audio' ? 'audio.mp3' : 'video.mp4'}
                <small>Completed · example</small>
              </div>
              <ArrowDownToLine size={22} />
            </div>
            <div className="demo-confetti">
              {Array.from({ length: 12 }, (_, i) => (
                <i key={i} style={{ '--i': i } as React.CSSProperties} />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="demo-disclaimer">
        <ShieldCheck size={12} />
        Demo only. No files are uploaded or downloaded.
      </div>
    </div>
  );
}

export function Tutorial({
  open,
  onOpenChange,
  initialLesson = 'video',
  onTry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLesson?: string;
  onTry: (target: string) => void;
}) {
  const [lessonId, setLessonId] = useState(initialLesson);
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (open) {
      setLessonId(initialLesson);
      setStep(0);
      setFinished(false);
    }
  }, [open, initialLesson]);
  const lesson = lessons.find((l) => l.id === lessonId) || lessons[0];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tutorial-dialog">
        <DialogHeader>
          <span className="lesson-eyebrow">
            <Sparkles size={14} /> YOUR ORBIT STARTS HERE
          </span>
          <DialogTitle>
            {finished ? 'You’re ready to make it yours.' : lesson.title}
          </DialogTitle>
          <DialogDescription>
            {finished
              ? 'Try these steps with your own media in the workspace.'
              : lesson.description}
          </DialogDescription>
        </DialogHeader>
        <Tabs
          value={lessonId}
          onValueChange={(v) => {
            setLessonId(String(v));
            setStep(0);
            setFinished(false);
          }}
        >
          <TabsList className="lesson-tabs">
            {lessons.map((l) => (
              <TabsTrigger key={l.id} value={l.id}>
                <l.icon size={15} />
                {l.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="tutorial-layout">
          <Demo lesson={lesson} step={step} />
          <div className="tutorial-instructions" aria-live="polite">
            <div className="lesson-step-label">
              {finished ? 'TUTORIAL COMPLETE' : `STEP 0${step + 1} / 04`}
            </div>
            <h3>
              {finished
                ? 'Your workspace is waiting.'
                : lesson.steps[step].title}
            </h3>
            <p>
              {finished
                ? 'Open the tool and follow the same steps. You can return to this tutorial any time from How to use.'
                : lesson.steps[step].body}
            </p>
            <div className="lesson-hint">
              <Zap size={16} />
              <span>{lesson.steps[step].hint}</span>
            </div>
            <div className="tutorial-dots" aria-label="Tutorial steps">
              {lesson.steps.map((s, i) => (
                <button
                  key={s.title}
                  aria-label={`Go to step ${i + 1}: ${s.title}`}
                  aria-current={step === i ? 'step' : undefined}
                  className={i <= step ? 'reached' : ''}
                  onClick={() => {
                    setStep(i);
                    setFinished(false);
                  }}
                >
                  {i < step ? <Check size={12} /> : i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="tutorial-footer">
          <button
            className="secondary-button"
            disabled={step === 0 && !finished}
            onClick={() => {
              if (finished) {
                setStep(0);
                setFinished(false);
              } else setStep((s) => s - 1);
            }}
          >
            {finished ? <RotateCcw size={15} /> : <ArrowLeft size={15} />}{' '}
            {finished ? 'Replay tutorial' : 'Back'}
          </button>
          <span>
            {finished
              ? 'All set. Let’s make something.'
              : 'Explore at your own pace.'}
          </span>
          <button
            className="primary-button"
            onClick={() => {
              if (finished) {
                onOpenChange(false);
                onTry(lesson.destination);
              } else if (step === 3) setFinished(true);
              else setStep((s) => s + 1);
            }}
          >
            {finished
              ? 'Open ' + lesson.label.toLowerCase()
              : lesson.steps[step].action}
            <ArrowRight size={16} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LearningCenter({
  onTutorial,
  onTry,
  onSettings,
}: {
  onTutorial: (id: string) => void;
  onTry: (target: string) => void;
  onSettings: () => void;
}) {
  return (
    <section className="learning-center">
      <div className="learn-heading">
        <span className="lesson-eyebrow">
          <BookOpen size={15} /> THE ORBIT FIELD GUIDE
        </span>
        <h1>
          A little guidance.
          <br />
          <span>Endless possibilities.</span>
        </h1>
        <p>
          Everything you need to go from “how?” to “done.”
          <br />
          Pick a tutorial and follow along, one step at a time.
        </p>
        <button className="primary-button" onClick={() => onTutorial('video')}>
          <Play size={16} fill="currentColor" />
          Take your first tutorial
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="learn-checklist">
        <span className="learn-check-icon">
          <Zap size={22} />
        </span>
        <div>
          <h2>First, connect your media engine.</h2>
          <p>
            Open Start-Orbit.cmd on your computer and keep its window open.
            Check for “Engine connected” in the top bar, then you’re ready to
            go.
          </p>
        </div>
        <button className="secondary-button" onClick={onSettings}>
          Connection settings
          <Settings2 size={15} />
        </button>
      </div>
      <div className="section-label">
        <h2>What would you like to do?</h2>
        <span>4 short, interactive tutorials</span>
      </div>
      <div className="lesson-grid">
        {lessons.map((l, i) => (
          <article className={'lesson-card lesson-color-' + i} key={l.id}>
            <div className="lesson-card-top">
              <span className="feature-icon">
                <l.icon size={22} />
              </span>
              <span>0{i + 1} / FIELD NOTES</span>
            </div>
            <h3>{l.label}</h3>
            <p>{l.description}</p>
            <ol>
              {l.steps.map((s) => (
                <li key={s.title}>{s.title}</li>
              ))}
            </ol>
            <div className="lesson-card-actions">
              <button onClick={() => onTutorial(l.id)}>
                <Play size={15} />
                Start tutorial
                <ArrowRight size={15} />
              </button>
              <button
                aria-label={`Open ${l.label}`}
                onClick={() => onTry(l.destination)}
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <div className="learn-tips">
        <div>
          <CircleHelp size={23} />
          <h3>Link not working?</h3>
          <p>
            Use a full public video link. Some sources restrict downloads, and
            private, live, or protected videos may be unavailable. An error on
            one batch link won’t stop the rest.
          </p>
        </div>
        <div>
          <WandSparkles size={23} />
          <h3>A cleaner watermark result</h3>
          <p>
            Choose a small, static watermark on a simple background. Give the
            selection a little margin. Blend approximates the background; blur
            obscures it.
          </p>
        </div>
        <div>
          <Clipboard size={23} />
          <h3>A few useful shortcuts</h3>
          <p>
            <kbd>Ctrl / ⌘ + K</kbd> Jump to the link field
            <br />
            <kbd>Enter</kbd> Find available formats
            <br />
            <kbd>Esc</kbd> Close a tutorial or dialog
          </p>
        </div>
      </div>
    </section>
  );
}
