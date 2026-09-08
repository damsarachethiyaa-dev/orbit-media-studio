'use client';
// The app's "shell": sidebar navigation (StudioNavigation), the platform
// list + brand icon renderer (platforms, PlatformIcon, PlatformDock), the
// animated hero graphic (MediaConstellation), the "your creative flow"
// sidebar (WorkflowPanel), and the three feature cards below the fold
// (StudioTools). Used by app/page.tsx.
import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Clock3,
  Globe2,
  Layers3,
  Link2,
  Orbit,
  Play,
  Settings2,
  Sparkles,
  WandSparkles,
  Zap,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';

export const platforms = [
  {
    name: 'YouTube',
    slug: 'youtube',
    color: '#ff5666',
    example: 'youtube.com/watch?v=…',
  },
  {
    name: 'TikTok',
    slug: 'tiktok',
    color: '#72efde',
    example: 'tiktok.com/@creator/video/…',
  },
  {
    name: 'Instagram',
    slug: 'instagram',
    color: '#f58bc8',
    example: 'instagram.com/reel/…',
  },
  { name: 'X', slug: 'x', color: '#e2e8ee', example: 'x.com/creator/status/…' },
  { name: 'Vimeo', slug: 'vimeo', color: '#69c7f1', example: 'vimeo.com/…' },
  {
    name: 'Facebook',
    slug: 'facebook',
    color: '#729fff',
    example: 'facebook.com/watch/?v=…',
  },
  {
    name: 'Twitch',
    slug: 'twitch',
    color: '#b593ff',
    example: 'twitch.tv/videos/…',
  },
  {
    name: 'Reddit',
    slug: 'reddit',
    color: '#ff956e',
    example: 'reddit.com/r/…/comments/…',
  },
  {
    name: 'Pinterest',
    slug: 'pinterest',
    color: '#ff6f88',
    example: 'pinterest.com/pin/…',
  },
  {
    name: 'SoundCloud',
    slug: 'soundcloud',
    color: '#ffad71',
    example: 'soundcloud.com/creator/…',
  },
  {
    name: 'Dailymotion',
    slug: 'dailymotion',
    color: '#92b9ff',
    example: 'dailymotion.com/video/…',
  },
];
export function PlatformIcon({
  platform,
  size = 22,
}: {
  platform: string;
  size?: number;
}) {
  const normalized = platform.toLowerCase();
  const p = platforms.find(
    (p) =>
      normalized === p.name.toLowerCase() ||
      normalized === p.slug ||
      (p.slug === 'x' && normalized.includes('twitter')),
  );
  if (!p) return <Globe2 size={size} aria-hidden="true" />;
  return (
    <span
      aria-hidden="true"
      className="platform-brand-icon"
      style={{
        width: size,
        height: size,
        backgroundColor: p.color,
        maskImage: `url(/brands/${p.slug}.svg)`,
        WebkitMaskImage: `url(/brands/${p.slug}.svg)`,
      }}
    />
  );
}
export function StudioNavigation({
  view,
  tab,
  onNavigate,
  onSettings,
  onHelp,
  activeJobs,
}: {
  view: string;
  tab: string;
  onNavigate: (view: string, audio?: boolean) => void;
  onSettings: () => void;
  onHelp: () => void;
  activeJobs: number;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  const items = [
    { view: 'download', label: 'Download', icon: Link2 },
    { view: 'studio', label: 'Watermark', icon: WandSparkles },
    { view: 'download', audio: true, label: 'Audio', icon: AudioLines },
    { view: 'batch', label: 'Batch', icon: Layers3 },
    { view: 'history', label: 'Library', icon: Clock3 },
    { view: 'learn', label: 'Learn', icon: BookOpen },
  ];
  function close() {
    if (isMobile) setOpenMobile(false);
  }
  return (
    <Sidebar className="app-sidebar studio-rail">
      <SidebarHeader className="brand">
        <span className="brand-symbol">
          <Orbit size={28} />
        </span>
        <span className="rail-wordmark">
          orbit<span>.</span>
        </span>
      </SidebarHeader>
      <SidebarContent className="nav-content">
        {items.map((item, i) => (
          <button
            key={i}
            className={
              'nav-item ' +
              (view === item.view &&
              (item.view !== 'download' ||
                (item.audio ? tab === 'audio' : tab === 'video'))
                ? 'active'
                : '')
            }
            title={item.label}
            onClick={() => {
              onNavigate(item.view, item.audio);
              close();
            }}
          >
            <item.icon />
            <span>{item.label}</span>
            {item.view === 'history' && activeJobs > 0 && (
              <b className="rail-count">{activeJobs}</b>
            )}
          </button>
        ))}
      </SidebarContent>
      <SidebarFooter className="sidebar-bottom">
        <button
          className="nav-item"
          onClick={() => {
            onSettings();
            close();
          }}
          title="Preferences"
        >
          <Settings2 />
          <span>Settings</span>
        </button>
        <button
          className="nav-item"
          onClick={() => {
            onHelp();
            close();
          }}
          title="Help and shortcuts"
        >
          <CircleHelp />
          <span>Help</span>
        </button>
        <div className="rail-profile" title="Personal workspace">
          Y<span />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
export function PlatformDock({
  onSelect,
  selected,
}: {
  onSelect: (name: string) => void;
  selected: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="source-dock">
      <div className="source-dock-heading">
        <span>YOUR FAVORITE PLATFORMS, ONE WORKSPACE</span>
        <span>
          <Globe2 size={13} />
          Auto-recognition
        </span>
      </div>
      <div className="source-grid">
        {platforms.slice(0, expanded ? 11 : 6).map((p) => (
          <button
            className={
              'source-tile ' + (selected === p.name ? 'is-selected' : '')
            }
            key={p.slug}
            style={{ '--brand-color': p.color } as React.CSSProperties}
            title={`Paste a public ${p.name} link: ${p.example}`}
            onClick={() => onSelect(p.name)}
          >
            <PlatformIcon platform={p.name} size={21} />
            <span>{p.name}</span>
          </button>
        ))}
        <button
          className="source-tile source-more"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronDown className="rotate-180" size={21} />
          ) : (
            <Globe2 size={21} />
          )}
          <span>{expanded ? 'Show less' : 'More'}</span>
        </button>
      </div>
      <p>
        Choose a platform, then paste your link. Available formats depend on the
        source.
      </p>
    </section>
  );
}
export function MediaConstellation() {
  return (
    <div className="media-constellation" aria-hidden="true">
      <div className="constellation-grid" />
      <div className="constellation-halo" />
      <div className="constellation-ring ring-outer" />
      <div className="constellation-ring ring-inner" />
      <div className="constellation-center">
        <ArrowDownToLine size={28} />
        <span />
      </div>
      {platforms.slice(0, 4).map((p, i) => (
        <div
          className={'constellation-node node-' + i}
          key={p.slug}
          style={{ '--brand-color': p.color } as React.CSSProperties}
        >
          <PlatformIcon platform={p.name} size={21} />
        </div>
      ))}
      <span className="constellation-coordinate">LINK → CREATE → KEEP</span>
    </div>
  );
}
export function WorkflowPanel({
  connected,
  active,
  completed,
  onTutorial,
  onSettings,
  onHistory,
}: {
  connected: boolean | null;
  active: number;
  completed: number;
  onTutorial: () => void;
  onSettings: () => void;
  onHistory: () => void;
}) {
  return (
    <aside className="workflow-panel">
      <div className="workflow-title">
        <span className="workflow-symbol">
          <Orbit size={20} />
        </span>
        <div>
          Your creative flow<span>FROM LINK TO LIBRARY</span>
        </div>
      </div>
      <div className="workflow-steps">
        {[
          {
            icon: Link2,
            title: 'Drop in a link',
            text: 'We’ll recognize the source.',
          },
          {
            icon: Settings2,
            title: 'Make it your format',
            text: 'Pick video quality or audio.',
          },
          {
            icon: ArrowDownToLine,
            title: 'Keep the good stuff',
            text: 'Save it from your library.',
          },
        ].map((s, i) => (
          <div className="workflow-step" key={s.title}>
            <span>
              <s.icon size={16} />
            </span>
            <div>
              <strong>{s.title}</strong>
              <p>{s.text}</p>
            </div>
            <small>0{i + 1}</small>
          </div>
        ))}
      </div>
      <button className="workflow-tutorial" onClick={onTutorial}>
        <span>
          <Play size={13} fill="currentColor" />
        </span>
        Show me how it works
        <ArrowUpRight size={16} />
      </button>
      <div className="engine-card">
        <div className="engine-caption">
          <span className={connected ? 'live-dot' : 'idle-dot'} />
          <span>
            {connected
              ? 'ENGINE ONLINE'
              : connected === null
                ? 'CHECKING CONNECTION'
                : 'ENGINE DISCONNECTED'}
          </span>
          <Zap size={13} />
        </div>
        <h3>
          {connected
            ? 'Ready for your next idea.'
            : 'Connect to start creating.'}
        </h3>
        <p>
          {connected
            ? 'Your media is processed by your connected engine.'
            : 'Open your local Orbit engine, then connect in settings.'}
        </p>
        <button onClick={connected ? onHistory : onSettings}>
          {connected
            ? `${active} in progress · ${completed} completed`
            : 'Open connection settings'}
          <ArrowRight size={14} />
        </button>
      </div>
    </aside>
  );
}
export function StudioTools({
  onNavigate,
}: {
  onNavigate: (view: string, audio?: boolean) => void;
}) {
  const tools = [
    {
      name: 'Watermark studio',
      label: 'REFINE YOUR FRAME',
      icon: WandSparkles,
      view: 'studio',
      desc: 'Select a region. Blend or blur. Give your video a cleaner finish.',
      action: 'Open studio',
      tone: 'mint',
    },
    {
      name: 'Audio extractor',
      label: 'FIND YOUR SOUND',
      icon: AudioLines,
      view: 'download',
      audio: true,
      desc: 'Keep the soundtrack, the conversation, or the moment. Export as MP3.',
      action: 'Extract audio',
      tone: 'violet',
    },
    {
      name: 'Batch downloads',
      label: 'DO MORE, TOGETHER',
      icon: Layers3,
      view: 'batch',
      desc: 'Bring multiple links into one organized queue. Less repetition, more creating.',
      action: 'Start a batch',
      tone: 'blue',
    },
  ];
  function move(e: React.PointerEvent<HTMLButtonElement>) {
    if (
      e.pointerType !== 'mouse' ||
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.motion === 'off'
    )
      return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--spot-x', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--spot-y', `${e.clientY - r.top}px`);
    e.currentTarget.style.setProperty(
      '--tilt-x',
      `${-(e.clientY - r.top - r.height / 2) / 65}deg`,
    );
    e.currentTarget.style.setProperty(
      '--tilt-y',
      `${(e.clientX - r.left - r.width / 2) / 65}deg`,
    );
  }
  return (
    <div className="studio-tools-grid">
      {tools.map((t, i) => (
        <button
          key={t.view + t.tone}
          className={'studio-tool-card tone-' + t.tone}
          onClick={() => onNavigate(t.view, t.audio)}
          onPointerMove={move}
          onPointerLeave={(e) => {
            e.currentTarget.style.setProperty('--tilt-x', '0deg');
            e.currentTarget.style.setProperty('--tilt-y', '0deg');
          }}
        >
          <div className="tool-card-top">
            <span className="studio-tool-icon">
              <t.icon size={24} />
            </span>
            <span className="tool-card-number">0{i + 1}</span>
          </div>
          <div className="tool-card-kicker">{t.label}</div>
          <h3>{t.name}</h3>
          <p>{t.desc}</p>
          <div className="tool-card-bottom">
            <span>
              {t.action}
              <ArrowUpRight size={15} />
            </span>
            {t.tone === 'violet' ? (
              <div className="mini-equalizer" aria-hidden="true">
                {Array.from({ length: 12 }, (_, i) => (
                  <i
                    key={i}
                    style={
                      {
                        '--bar': i,
                        '--bar-height': `${7 + ((i * 7) % 18)}px`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
            ) : t.tone === 'blue' ? (
              <div className="mini-stack" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            ) : (
              <div className="mini-selection" aria-hidden="true">
                <Sparkles size={16} />
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
