/**
 * Landing.jsx — premium fintech meets community platform.
 *
 * Skills applied: emil-design-eng (springs, custom ease-out, prefers-reduced-motion,
 * blur-to-mask, press feedback) + impeccable (no em-dashes, transform/opacity/filter/
 * clip-path only, exponential ease-out, varied spacing for rhythm).
 *
 * Section transitions use diagonal clipPath cuts (no muddy gradients):
 *   • Colored sections that follow white: top clipped at left (`polygon(0 40px, 100% 0, …)`)
 *   • White sections that follow colored: top clipped at right (`polygon(0 0, 100% 40px, …)`)
 *   • Each clipped section gets marginTop: -40 so it overlaps the previous by 40px
 *   • All clipped sections add 40px to top padding so content clears the cut area
 *   • Colored sections that PRECEDE a clipped white add 40px to bottom padding so
 *     trailing content (e.g. "Today.") is not visually obscured by the overlap.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import CountUp from "../components/CountUp";
import useIsMobile from "../hooks/useIsMobile";
import { fetchPublicLandingStats } from "../lib/publicStats";

/* ─── Tokens ─────────────────────────────────────────────────────────────── */
const T = {
  ink: "#181d26",
  body: "#41454d",
  muted: "#41454d",
  mutedSoft: "#8a8f99",
  hairline: "#dddddd",
  hairlineSoft: "#eef0f3",
  canvas: "#ffffff",
  coral: "#aa2d00",
  onDark: "#ffffff",
  onDarkBody: "#888888",
  onDarkHairline: "rgba(255,255,255,0.08)",
};
const FONT = "'DM Sans', sans-serif";

/* ─── Motion ─────────────────────────────────────────────────────────────── */
const SPRING_DEFAULT = { type: "spring", stiffness: 100, damping: 18 };
const SPRING_HOVER   = { type: "spring", stiffness: 400, damping: 24 };
const SPRING_WORD    = { type: "spring", stiffness: 120, damping: 20 };
const SPRING_MAG     = { stiffness: 300, damping: 20 };
const SPRING_QUICK   = { type: "spring", stiffness: 350, damping: 22 };
const EASE_OUT       = [0.23, 1, 0.32, 1];
const EASE_OUT_QUART = [0.165, 0.84, 0.44, 1];
const VIEW_ONCE      = { once: true, margin: "-15% 0px" };

/* ─── clipPath transition constants ──────────────────────────────────────── */
const CLIP_LEFT_LOW  = "polygon(0 40px, 100% 0, 100% 100%, 0 100%)";
const CLIP_RIGHT_LOW = "polygon(0 0, 100% 40px, 100% 100%, 0 100%)";
const CLIP_OVERLAP   = -40;

const STYLE_ID = "sl-landing-styles";

/* ─── One-time global style injection ────────────────────────────────────── */
function useLandingStyles() {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      @keyframes sl-marquee {
        from { transform: translate3d(0, 0, 0); }
        to   { transform: translate3d(-33.3333%, 0, 0); }
      }
      .sl-marquee-track {
        animation: sl-marquee 40s linear infinite;
        will-change: transform;
      }
      .sl-no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
      .sl-no-scrollbar::-webkit-scrollbar { display: none; width: 0; height: 0; }
      @media (prefers-reduced-motion: reduce) {
        .sl-marquee-track { animation: none !important; transform: none !important; }
      }
    `;
    document.head.appendChild(s);
  }, []);
}

/* ─── Word-stagger primitive ─────────────────────────────────────────────── */
function WordStagger({
  text,
  stagger = 0.04,
  spring = SPRING_WORD,
  delay = 0,
  trigger = "mount",
  blurPx = 8,
  yPx = 40,
}) {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, VIEW_ONCE);
  const active = trigger === "mount" ? true : inView;
  const words = text.split(" ");

  const parent = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduced ? 0 : stagger,
        delayChildren: reduced ? 0 : delay,
      },
    },
  };
  const child = {
    hidden: reduced
      ? { y: 0, opacity: 1, filter: "blur(0px)" }
      : { y: yPx, opacity: 0, filter: `blur(${blurPx}px)` },
    show: { y: 0, opacity: 1, filter: "blur(0px)", transition: spring },
  };

  return (
    <motion.span
      ref={ref}
      variants={parent}
      initial="hidden"
      animate={active ? "show" : "hidden"}
      style={{ display: "inline" }}
    >
      {words.map((w, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            overflow: "hidden",
            whiteSpace: "pre",
            verticalAlign: "top",
            paddingBottom: "0.1em",
          }}
        >
          <motion.span
            variants={child}
            style={{
              display: "inline-block",
              willChange: "transform, filter, opacity",
            }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

/* ─── Magnetic button ────────────────────────────────────────────────────── */
function MagneticButton({
  to,
  children,
  style,
  radius = 80,
  max = 6,
  as = Link,
  ...rest
}) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const x = useSpring(0, SPRING_MAG);
  const y = useSpring(0, SPRING_MAG);

  useEffect(() => {
    if (reduced) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(hover: none), (pointer: coarse)").matches
    ) {
      return;
    }
    const el = ref.current;
    if (!el) return;
    let raf = null;
    function move(e) {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > radius) { x.set(0); y.set(0); return; }
        const factor = (1 - dist / radius) * max;
        const ux = dist === 0 ? 0 : dx / dist;
        const uy = dist === 0 ? 0 : dy / dist;
        x.set(ux * factor);
        y.set(uy * factor);
      });
    }
    function leave() { x.set(0); y.set(0); }
    window.addEventListener("mousemove", move, { passive: true });
    document.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("mousemove", move);
      document.removeEventListener("mouseleave", leave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced, radius, max, x, y]);

  const Inner = as;
  return (
    <motion.span
      ref={ref}
      whileTap={{ scale: 0.97 }}
      transition={SPRING_QUICK}
      style={{ x, y, display: "inline-block", willChange: "transform" }}
    >
      <Inner to={to} style={style} {...rest}>
        {children}
      </Inner>
    </motion.span>
  );
}

/* ─── Reveal helper ──────────────────────────────────────────────────────── */
function Reveal({ children, delay = 0, style, y = 30, x = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, VIEW_ONCE);
  const reduced = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, y, x }}
      animate={inView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ ...SPRING_DEFAULT, delay }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/* ─── Eyebrow primitive ──────────────────────────────────────────────────── */
function Eyebrow({ children, color = T.muted, style }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "2px",
        textTransform: "uppercase",
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   1. NAV
   ════════════════════════════════════════════════════════════════════════ */
function LandingNav() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(255,255,255,0.78)",
        backdropFilter: "saturate(140%) blur(12px)",
        WebkitBackdropFilter: "saturate(140%) blur(12px)",
        borderBottom: `1px solid ${T.hairline}`,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link
          to="/"
          style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 7,
              background: T.ink,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 15 }}>🍣</span>
          </span>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 17,
              fontWeight: 700,
              color: T.ink,
              letterSpacing: "-0.015em",
            }}
          >
            SushiLabs
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            to="/login"
            style={{
              fontFamily: FONT,
              fontSize: 14,
              fontWeight: 500,
              color: T.body,
              textDecoration: "none",
              padding: "10px 16px",
              borderRadius: 8,
            }}
          >
            Sign in
          </Link>
          <MagneticButton
            to="/register"
            radius={80}
            max={6}
            style={{
              fontFamily: FONT,
              fontSize: 14,
              fontWeight: 500,
              color: T.onDark,
              textDecoration: "none",
              padding: "10px 18px",
              borderRadius: 8,
              background: T.ink,
              display: "inline-block",
            }}
          >
            Join free
          </MagneticButton>
        </div>
      </div>
    </nav>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   2. HERO
   ════════════════════════════════════════════════════════════════════════ */
const ACCENT_CYCLE = ["Ship work.", "Get paid.", "Build together.", "Own it."];

function Hero({ isMobile }) {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();

  const blobY1 = useTransform(scrollY, (v) => (reduced ? 0 : v * 0.02));
  const blobY2 = useTransform(scrollY, (v) => (reduced ? 0 : v * -0.02));

  const [accentIdx, setAccentIdx] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(
      () => setAccentIdx((i) => (i + 1) % ACCENT_CYCLE.length),
      3000,
    );
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <section
      style={{
        position: "relative",
        background: T.canvas,
        // Both viewports: natural height. 100vh would create huge dead space
        // below buttons when content starts 32px from the nav (per user spec).
        minHeight: "auto",
        display: "flex",
        flexDirection: "column",
        // Content starts 32px below the 64px-tall sticky nav (both viewports).
        // Bottom kept tight so buttons sit close to the marquee strip.
        padding: isMobile ? "32px 20px 24px" : "32px 32px 40px",
        // Top-anchor content so 32px padding-top is the actual gap to nav.
        justifyContent: "flex-start",
        overflow: "hidden",
      }}
    >
      <motion.div
        aria-hidden="true"
        style={{
          y: blobY1,
          position: "absolute",
          top: "-15%",
          right: "-10%",
          width: 640,
          height: 640,
          borderRadius: "50%",
          background: T.coral,
          filter: "blur(120px)",
          opacity: 0.04,
          pointerEvents: "none",
          willChange: "transform",
          zIndex: 0,
        }}
      />
      <motion.div
        aria-hidden="true"
        style={{
          y: blobY2,
          position: "absolute",
          bottom: "-20%",
          left: "-10%",
          width: 640,
          height: 640,
          borderRadius: "50%",
          background: T.ink,
          filter: "blur(120px)",
          opacity: 0.04,
          pointerEvents: "none",
          willChange: "transform",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1280,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Eyebrow → headline gap: 8px */}
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{ marginBottom: 8 }}
        >
          <Eyebrow>EARN FOR REAL WORK · INDIA</Eyebrow>
        </motion.div>

        <h1
          style={{
            fontFamily: FONT,
            fontSize: isMobile ? 42 : 96,
            fontWeight: 800,
            lineHeight: 0.98,
            color: T.ink,
            margin: 0,
            letterSpacing: "-0.03em",
            maxWidth: 1100,
          }}
        >
          <span style={{ display: "block" }}>
            <WordStagger text="Complete tasks." trigger="mount" />
          </span>
          <span style={{ display: "block" }}>
            <WordStagger text="Earn rewards." trigger="mount" delay={0.08} />
          </span>
          <span style={{ display: "block", color: T.coral }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={accentIdx}
                initial={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, y: 20, filter: "blur(12px)" }
                }
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, y: -20, filter: "blur(12px)" }
                }
                transition={{ duration: 0.35, ease: EASE_OUT_QUART }}
                style={{
                  display: "inline-block",
                  willChange: "filter, transform, opacity",
                }}
              >
                {accentIdx === 0 ? (
                  <WordStagger
                    text={ACCENT_CYCLE[0]}
                    trigger="mount"
                    delay={0.16}
                  />
                ) : (
                  ACCENT_CYCLE[accentIdx]
                )}
              </motion.span>
            </AnimatePresence>
          </span>
        </h1>

        {/* Headline → body: 16. Body → buttons: 24. */}
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_DEFAULT, delay: 0.6 }}
          style={{
            fontFamily: FONT,
            fontSize: 18,
            fontWeight: 400,
            lineHeight: 1.6,
            color: T.body,
            margin: "16px 0 24px",
            maxWidth: 480,
          }}
        >
          SushiLabs pays Indian community members for meaningful work: testing,
          research, creative tasks. Pick a task, submit your work, get paid to
          UPI in hours.
        </motion.p>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_DEFAULT, delay: 0.8 }}
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            flexWrap: "wrap",
            gap: isMobile ? 8 : 12,
            maxWidth: isMobile ? 280 : "none",
          }}
        >
          <MagneticButton
            to="/register"
            radius={80}
            max={6}
            style={{
              fontFamily: FONT,
              fontSize: 16,
              fontWeight: 500,
              color: T.onDark,
              textDecoration: "none",
              padding: "14px 28px",
              borderRadius: 10,
              background: T.ink,
              display: "inline-block",
              textAlign: "center",
              letterSpacing: "-0.005em",
            }}
          >
            Get started free →
          </MagneticButton>
          <Link
            to="/login"
            style={{
              fontFamily: FONT,
              fontSize: 16,
              fontWeight: 500,
              color: T.ink,
              textDecoration: "none",
              padding: "14px 26px",
              borderRadius: 10,
              background: T.canvas,
              // 1.5px ink border so it reads as a button, not empty space.
              border: `1.5px solid ${T.ink}`,
              display: "inline-block",
              textAlign: "center",
            }}
          >
            Sign in
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   3. MARQUEE
   ════════════════════════════════════════════════════════════════════════ */
const MARQUEE_ITEMS = [
  "2,400+ tasks completed",
  "620+ members",
  "₹40L+ paid out",
  "48hr reviews",
  "UPI payouts",
  "No platform fees",
  "Human-reviewed",
  "Daily payouts",
  "Indian creator economy",
  "Trusted by 600+",
];

function Marquee() {
  const tripled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  const maskGradient =
    "linear-gradient(90deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,1) 25%, rgba(0,0,0,1) 75%, rgba(0,0,0,0.5) 100%)";
  return (
    <section
      style={{
        background: T.canvas,
        borderTop: `1px solid ${T.hairline}`,
        borderBottom: `1px solid ${T.hairline}`,
        padding: "16px 0",
      }}
    >
      <div
        style={{
          overflow: "hidden",
          WebkitMaskImage: maskGradient,
          maskImage: maskGradient,
        }}
      >
        <div
          className="sl-marquee-track"
          style={{
            display: "flex",
            gap: 32,
            whiteSpace: "nowrap",
          }}
        >
          {tripled.map((item, i) => (
            <span
              key={i}
              style={{
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: T.muted,
                display: "inline-flex",
                alignItems: "center",
                gap: 32,
                flexShrink: 0,
              }}
            >
              {item}
              <span style={{ color: T.hairline, fontSize: 10 }}>●</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   4. STATS — 2x2 mobile, 52px numbers
   ════════════════════════════════════════════════════════════════════════ */
const STAT_FALLBACK = {
  member_count: 620,
  total_paid_out: 4032000,
  approvals_30d: 412,
};

function Stats({ isMobile }) {
  const [stats, setStats] = useState(null);
  const ref = useRef(null);
  const inView = useInView(ref, VIEW_ONCE);
  const reduced = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    fetchPublicLandingStats().then((s) => {
      if (!cancelled) setStats(s);
    });
    return () => { cancelled = true; };
  }, []);

  const resolved = stats || STAT_FALLBACK;

  const cells = [
    {
      label: "Members",
      value: resolved.member_count,
      fmt: (n) => Math.round(n).toLocaleString("en-IN"),
      suffix: "+",
    },
    {
      label: "Paid to members",
      value: resolved.total_paid_out,
      fmt: (n) => `₹${Math.round(n).toLocaleString("en-IN")}`,
      suffix: "",
    },
    {
      label: "Approvals · 30 days",
      value: resolved.approvals_30d,
      fmt: (n) => Math.round(n).toLocaleString("en-IN"),
      suffix: "",
    },
    {
      label: "Avg. review window",
      value: 48,
      fmt: (n) => Math.round(n).toString(),
      suffix: "h",
    },
  ];

  const numberSize = isMobile ? 52 : 80;

  return (
    <section style={{ background: T.canvas, padding: isMobile ? "16px 0" : "20px 0" }}>
      <div
        ref={ref}
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: isMobile ? "32px 16px" : 0,
        }}
      >
        {cells.map((c, i) => {
          const desktopBorder =
            !isMobile && i < cells.length - 1
              ? { borderRight: `1px solid ${T.hairline}` }
              : {};
          return (
            <motion.div
              key={c.label}
              initial={reduced ? false : { opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ ...SPRING_DEFAULT, delay: i * 0.08 }}
              style={{
                padding: isMobile ? 0 : "0 32px",
                ...desktopBorder,
                minWidth: 0, // allow numbers to shrink without overflow
              }}
            >
              <motion.div
                initial={reduced ? false : { scale: 0.92 }}
                animate={inView ? { scale: 1 } : {}}
                transition={{ ...SPRING_DEFAULT, delay: 0.15 + i * 0.08 }}
                style={{
                  fontFamily: FONT,
                  fontSize: numberSize,
                  fontWeight: 800,
                  color: T.ink,
                  letterSpacing: "-0.04em",
                  lineHeight: 1,
                  fontVariantNumeric: "tabular-nums",
                  willChange: "transform",
                  transformOrigin: "left center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {inView ? (
                  <CountUp to={c.value} format={c.fmt} duration={1500} />
                ) : (
                  c.fmt(0)
                )}
                {c.suffix && (
                  <span style={{ color: T.coral, marginLeft: 2 }}>
                    {c.suffix}
                  </span>
                )}
              </motion.div>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "2px",
                  textTransform: "uppercase",
                  color: T.muted,
                  marginTop: 8,
                }}
              >
                {c.label}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   5. HOW IT WORKS
   ════════════════════════════════════════════════════════════════════════ */
const STEPS = [
  {
    num: "01",
    title: "Browse open tasks",
    desc:
      "See what's available. Each task lists the reward, time estimate, and what proof we need.",
  },
  {
    num: "02",
    title: "Do the work",
    desc:
      "Complete the task at your own pace. Most take 15 to 60 minutes. Submit a screenshot or link.",
  },
  {
    num: "03",
    title: "We review fast",
    desc:
      "Human review within 48 hours. Approve, reject with feedback, or ping you back for a fix.",
  },
  {
    num: "04",
    title: "Withdraw to UPI",
    desc:
      "Approved earnings hit your wallet. Withdraw anytime once you cross the minimum.",
  },
];

function HowItWorks({ isMobile }) {
  return (
    <section style={{ background: T.canvas, padding: isMobile ? "16px 0" : "20px 0" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <Reveal>
          <Eyebrow style={{ marginBottom: 8 }}>HOW IT WORKS</Eyebrow>
        </Reveal>
        <Reveal delay={0.06}>
          <h2
            style={{
              fontFamily: FONT,
              fontSize: isMobile ? 36 : 72,
              fontWeight: 800,
              color: T.ink,
              letterSpacing: "-0.035em",
              lineHeight: 0.98,
              margin: "0 0 24px",
              maxWidth: 800,
            }}
          >
            Four steps.
          </h2>
        </Reveal>

        <div>
          {STEPS.map((step, i) => (
            <HowItWorksRow
              key={step.num}
              step={step}
              index={i}
              isLast={i === STEPS.length - 1}
              isMobile={isMobile}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksRow({ step, index, isLast, isMobile }) {
  const ref = useRef(null);
  const inView = useInView(ref, VIEW_ONCE);
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(false);

  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, x: -40 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ ...SPRING_DEFAULT, delay: index * 0.12 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "120px 1fr 1fr",
        // Mobile: tight gaps. step→title 4, title→desc 8.
        rowGap: isMobile ? 4 : 0,
        columnGap: isMobile ? 0 : 48,
        alignItems: "start",
        padding: isMobile ? "24px 16px" : "48px 24px",
        borderTop: `1px solid ${T.hairline}`,
        borderBottom: isLast ? `1px solid ${T.hairline}` : "none",
      }}
    >
      <motion.div
        animate={{
          scale: hover && !reduced ? 1.4 : 1,
          color: hover ? T.coral : T.hairline,
        }}
        transition={SPRING_HOVER}
        style={{
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "2px",
          fontVariantNumeric: "tabular-nums",
          textTransform: "uppercase",
          transformOrigin: "left center",
          willChange: "transform, color",
        }}
      >
        Step {step.num}
      </motion.div>
      <h3
        style={{
          fontFamily: FONT,
          fontSize: isMobile ? 22 : 32,
          fontWeight: 700,
          color: T.ink,
          margin: 0,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          // Mobile: title→desc gap 8 via margin-bottom.
          marginBottom: isMobile ? 8 : 0,
        }}
      >
        {step.title}
      </h3>
      <motion.p
        animate={{ x: hover && !reduced ? 8 : 0 }}
        transition={SPRING_HOVER}
        style={{
          fontFamily: FONT,
          fontSize: 15,
          color: T.body,
          margin: 0,
          maxWidth: 320,
          lineHeight: 1.55,
          willChange: "transform",
        }}
      >
        {step.desc}
      </motion.p>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   6. CATEGORIES
   ════════════════════════════════════════════════════════════════════════ */
const CATEGORIES = [
  { name: "Product testing",    count: "180+ tasks", reward: "₹400 to ₹3,200" },
  { name: "Research tasks",     count: "120+ tasks", reward: "₹240 to ₹1,600" },
  { name: "Community feedback", count: "95+ tasks",  reward: "₹160 to ₹1,200" },
  { name: "Creative work",      count: "70+ tasks",  reward: "₹800 to ₹6,400" },
  { name: "Technical tasks",    count: "45+ tasks",  reward: "₹1,200 to ₹8,000" },
  { name: "Data entry",         count: "65+ tasks",  reward: "₹400 to ₹2,000" },
];

function Categories({ isMobile }) {
  return (
    <section style={{ background: T.canvas, padding: isMobile ? "16px 0 40px" : "20px 0 40px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <Reveal>
          <Eyebrow style={{ marginBottom: 8 }}>WORK CATEGORIES</Eyebrow>
        </Reveal>
        <Reveal delay={0.06}>
          <h2
            style={{
              fontFamily: FONT,
              fontSize: isMobile ? 36 : 72,
              fontWeight: 800,
              color: T.ink,
              letterSpacing: "-0.035em",
              lineHeight: 0.98,
              margin: "0 0 24px",
              maxWidth: 800,
            }}
          >
            What members ship.
          </h2>
        </Reveal>

        <div
          className={isMobile ? "sl-no-scrollbar" : undefined}
          style={
            isMobile
              ? {
                  display: "flex",
                  gap: 12,
                  overflowX: "scroll",
                  scrollSnapType: "x mandatory",
                  WebkitOverflowScrolling: "touch",
                  paddingBottom: 4,
                  // Bleed outside container so cards align edge-to-edge.
                  marginLeft: -24,
                  marginRight: -24,
                  paddingLeft: 24,
                  // Extra right padding shows partial 3rd card as scroll hint.
                  paddingRight: 80,
                }
              : {
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 16,
                }
          }
        >
          {CATEGORIES.map((cat, i) => (
            <CategoryCard key={cat.name} cat={cat} index={i} isMobile={isMobile} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryCard({ cat, index, isMobile }) {
  const ref = useRef(null);
  const inView = useInView(ref, VIEW_ONCE);
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(false);

  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 30 }}
      animate={
        inView
          ? {
              opacity: 1,
              y: hover && !reduced ? -6 : 0,
              borderColor: hover ? T.ink : T.hairline,
              boxShadow:
                hover && !reduced
                  ? "0 12px 32px rgba(0,0,0,0.08)"
                  : "0 0 0 rgba(0,0,0,0)",
            }
          : {}
      }
      transition={{
        ...SPRING_DEFAULT,
        delay: index * 0.06,
        borderColor: { duration: 0.2, ease: EASE_OUT },
        boxShadow: SPRING_HOVER,
        y: SPRING_HOVER,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileTap={{ scale: 0.99 }}
      style={{
        background: T.canvas,
        border: `1px solid ${T.hairline}`,
        borderRadius: 8,
        padding: isMobile ? 24 : 32,
        minWidth: isMobile ? 220 : "auto",
        scrollSnapAlign: isMobile ? "start" : "none",
        flexShrink: isMobile ? 0 : 1,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        willChange: "transform",
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 20,
          fontWeight: 700,
          color: T.ink,
          letterSpacing: "-0.015em",
          marginBottom: 8,
        }}
      >
        {cat.name}
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 14,
          color: T.mutedSoft,
          fontWeight: 500,
        }}
      >
        {cat.count}
      </div>
      <motion.div
        animate={{ color: hover ? T.coral : T.mutedSoft }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        style={{
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          marginTop: "auto",
          paddingTop: 16,
        }}
      >
        {cat.reward}
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   7. WHY US — dark slab, clipPath top (left-low cut after white above)
   ════════════════════════════════════════════════════════════════════════ */
const PILLARS = [
  {
    num: "01",
    title: "Real payouts",
    body:
      "Money in your wallet within 48 hours of approval. No vague points. No months of waiting. No hidden fees.",
  },
  {
    num: "02",
    title: "Built in India",
    body:
      "UPI payouts. Rupee pricing. Indian-locale formatting. Designed end to end for the Indian creator economy.",
  },
  {
    num: "03",
    title: "Reviews you can trust",
    body:
      "Every submission gets a human review. If we reject, we tell you why and let you re-submit after a fix.",
  },
];

function WhyUs({ isMobile }) {
  const ref = useRef(null);
  const inView = useInView(ref, VIEW_ONCE);
  const reduced = useReducedMotion();

  return (
    <section
      style={{
        position: "relative",
        background: T.ink,
        // Top: 40 clip eat + content gap = 72 mobile / 80 desktop.
        // Bottom: ≥40 needed so content clears the next section's clip overlap.
        padding: isMobile ? "72px 0 40px" : "80px 0 56px",
        color: T.onDark,
        marginTop: CLIP_OVERLAP,
        clipPath: CLIP_LEFT_LOW,
        WebkitClipPath: CLIP_LEFT_LOW,
      }}
    >
      <div
        ref={ref}
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 24px",
        }}
      >
        <Eyebrow color={T.coral} style={{ marginBottom: 8 }}>
          WHY SUSHILABS
        </Eyebrow>
        <h2
          style={{
            fontFamily: FONT,
            fontSize: isMobile ? 36 : 56,
            fontWeight: 800,
            color: T.onDark,
            letterSpacing: "-0.035em",
            lineHeight: 0.98,
            margin: "0 0 32px",
            maxWidth: 800,
          }}
        >
          Built for the work.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: isMobile ? 40 : 0,
          }}
        >
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.num}
              initial={
                reduced ? false : { clipPath: "inset(0 100% 0 0)", opacity: 0 }
              }
              animate={
                inView ? { clipPath: "inset(0 0% 0 0)", opacity: 1 } : {}
              }
              transition={{
                duration: 0.8,
                ease: EASE_OUT_QUART,
                delay: i * 0.2,
              }}
              style={{
                padding: isMobile ? "0" : "0 40px",
                paddingTop: isMobile && i > 0 ? 40 : 0,
                borderRight:
                  !isMobile && i < PILLARS.length - 1
                    ? `1px solid ${T.onDarkHairline}`
                    : "none",
                borderTop:
                  isMobile && i > 0 ? `1px solid ${T.onDarkHairline}` : "none",
                willChange: "clip-path, opacity",
              }}
            >
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 48,
                  fontWeight: 800,
                  color: T.coral,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  marginBottom: 16,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {p.num}
              </div>
              <h3
                style={{
                  fontFamily: FONT,
                  fontSize: isMobile ? 24 : 28,
                  fontWeight: 700,
                  color: T.onDark,
                  margin: "0 0 8px",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                {p.title}
              </h3>
              <p
                style={{
                  fontFamily: FONT,
                  fontSize: 15,
                  color: T.onDarkBody,
                  margin: 0,
                  lineHeight: 1.6,
                  maxWidth: 360,
                }}
              >
                {p.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   8. TESTIMONIALS — white, clipPath top (right-low cut after dark above)
   ════════════════════════════════════════════════════════════════════════ */
const QUOTES = [
  {
    text:
      "Got paid ₹2,400 for one weekend of testing. Smooth UPI, clear feedback when I had a question. The briefs are actually honest.",
    name: "Aarav S.",
    since: "2024",
    accent: "#fcab79",
    initial: "A",
  },
  {
    text:
      "I have used a dozen task platforms. SushiLabs is the only one that respects your time. No spammy notifications, no point grinding, just real work that pays in rupees.",
    name: "Priya K.",
    since: "2023",
    accent: "#a8d8c4",
    initial: "P",
  },
  {
    text:
      "The 48 hour review SLA is real. I have submitted at midnight and had ₹600 in my UPI by Sunday afternoon. That alone makes it different from every freelance app I have tried.",
    name: "Rohan M.",
    since: "2024",
    accent: "#f4d35e",
    initial: "R",
  },
];

function Testimonials({ isMobile }) {
  const reduced = useReducedMotion();
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % QUOTES.length), 6000);
    return () => clearInterval(id);
  }, [reduced]);

  const q = QUOTES[idx];

  return (
    <section
      style={{
        position: "relative",
        background: T.canvas,
        // Content-determined height. Padding 56/40 per spec. The dot-nav
        // wrapper carries an extra marginBottom: 24 for the dots→bottom gap.
        padding: "56px 0 40px",
        marginTop: CLIP_OVERLAP,
        clipPath: CLIP_RIGHT_LOW,
        WebkitClipPath: CLIP_RIGHT_LOW,
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <Reveal>
          <Eyebrow style={{ marginBottom: 8 }}>WHAT MEMBERS SAY</Eyebrow>
        </Reveal>

        <Reveal delay={0.06}>
          <div style={{ position: "relative" }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.blockquote
                key={idx}
                initial={reduced ? false : { opacity: 0, filter: "blur(6px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={
                  reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(6px)" }
                }
                transition={{ duration: 0.4, ease: EASE_OUT }}
                style={{
                  margin: 0,
                  willChange: "filter, opacity",
                }}
              >
                <motion.p
                  variants={{
                    hidden: {},
                    show: {
                      transition: {
                        staggerChildren: reduced ? 0 : 0.02,
                      },
                    },
                  }}
                  initial="hidden"
                  animate="show"
                  style={{
                    fontFamily: FONT,
                    fontSize: isMobile ? 22 : 32,
                    fontWeight: 500,
                    lineHeight: isMobile ? 1.5 : 1.4,
                    color: T.ink,
                    letterSpacing: "-0.015em",
                    margin: "0 0 16px",
                    maxWidth: 900,
                  }}
                >
                  <span style={{ color: T.coral }}>“</span>
                  {q.text.split(" ").map((w, i) => (
                    <motion.span
                      key={i}
                      variants={{
                        hidden: reduced ? { opacity: 1 } : { opacity: 0 },
                        show: { opacity: 1, transition: { duration: 0.3 } },
                      }}
                      style={{ display: "inline" }}
                    >
                      {w}
                      {i < q.text.split(" ").length - 1 ? " " : ""}
                    </motion.span>
                  ))}
                  <span style={{ color: T.coral }}>”</span>
                </motion.p>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    aria-hidden="true"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      background: q.accent,
                      color: T.ink,
                      fontFamily: FONT,
                      fontSize: 16,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {q.initial}
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: FONT,
                        fontSize: 15,
                        fontWeight: 600,
                        color: T.ink,
                        letterSpacing: "-0.005em",
                      }}
                    >
                      {q.name}
                    </div>
                    <div
                      style={{
                        fontFamily: FONT,
                        fontSize: 13,
                        color: T.muted,
                        marginTop: 2,
                      }}
                    >
                      Member · since {q.since}
                    </div>
                  </div>
                </div>
              </motion.blockquote>
            </AnimatePresence>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginTop: 16,
              marginBottom: 24,
            }}
          >
            {QUOTES.map((_, i) => (
              <motion.button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Quote ${i + 1} of ${QUOTES.length}`}
                whileTap={{ scale: 0.9 }}
                animate={{
                  width: i === idx ? 28 : 10,
                  backgroundColor: i === idx ? T.ink : T.hairline,
                }}
                transition={{ type: "spring", stiffness: 200, damping: 25 }}
                style={{
                  height: 10,
                  borderRadius: 5,
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  willChange: "width",
                }}
              />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   9. FINAL CTA — coral, clipPath top (left-low after white above)
   Extra bottom padding so "Today." clears the overlap with the next section.
   ════════════════════════════════════════════════════════════════════════ */
function FinalCTA({ isMobile }) {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, VIEW_ONCE);

  const headlineLines = ["Pick a task.", "Get paid.", "Today."];

  return (
    <motion.section
      ref={ref}
      initial={reduced ? false : { scale: 1.02 }}
      animate={inView ? { scale: 1 } : {}}
      transition={{ duration: 0.9, ease: EASE_OUT_QUART }}
      style={{
        background: T.coral,
        // Top: 40 clip eat + 56 content = 96 mobile / 80 desktop.
        // Bottom: tightened to spec cap. Buttons sit between "Today." and the
        // FAQ overlap zone, so 40-56 bottom is safe for the headline.
        padding: isMobile ? "96px 0 40px" : "80px 0 56px",
        textAlign: "center",
        color: T.onDark,
        position: "relative",
        // overflow: visible per spec (clipPath already clips; let any halos render)
        overflow: "visible",
        willChange: "transform",
        transformOrigin: "center center",
        // Coral transition uses a shallow clip so the diagonal never reaches
        // into the testimonial content above. Mobile shallower than desktop:
        // 12px clip / -12 margin on phones; 20px / -20 on desktop.
        marginTop: isMobile ? -12 : -20,
        clipPath: isMobile
          ? "polygon(0 12px, 100% 0, 100% 100%, 0 100%)"
          : "polygon(0 20px, 100% 0, 100% 100%, 0 100%)",
        WebkitClipPath: isMobile
          ? "polygon(0 12px, 100% 0, 100% 100%, 0 100%)"
          : "polygon(0 20px, 100% 0, 100% 100%, 0 100%)",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <Reveal>
          <Eyebrow color="rgba(255,255,255,0.7)" style={{ marginBottom: 16 }}>
            READY WHEN YOU ARE
          </Eyebrow>
        </Reveal>

        <h2
          style={{
            fontFamily: FONT,
            fontSize: isMobile ? 52 : 72,
            fontWeight: 800,
            lineHeight: 0.98,
            color: T.onDark,
            letterSpacing: "-0.035em",
            margin: "0 0 24px",
          }}
        >
          {headlineLines.map((line, i) => (
            <span key={line} style={{ display: "block" }}>
              <WordStagger text={line} trigger="inView" delay={i * 0.1} />
            </span>
          ))}
        </h2>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ ...SPRING_DEFAULT, delay: 0.5 }}
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: isMobile ? 8 : 12,
            justifyContent: "center",
            maxWidth: isMobile ? 280 : "none",
            margin: isMobile ? "0 auto" : 0,
          }}
        >
          <MagneticButton
            to="/register"
            radius={80}
            max={6}
            style={{
              fontFamily: FONT,
              fontSize: 16,
              fontWeight: 600,
              color: T.coral,
              textDecoration: "none",
              padding: "14px 28px",
              borderRadius: 10,
              background: T.onDark,
              display: "inline-block",
              letterSpacing: "-0.005em",
              textAlign: "center",
              width: isMobile ? "100%" : "auto",
            }}
          >
            Get started free →
          </MagneticButton>
          <MagneticButton
            to="/login"
            radius={80}
            max={6}
            style={{
              fontFamily: FONT,
              fontSize: 16,
              fontWeight: 500,
              color: T.onDark,
              textDecoration: "none",
              padding: "14px 26px",
              borderRadius: 10,
              background: "transparent",
              border: `1.5px solid rgba(255,255,255,0.55)`,
              display: "inline-block",
              textAlign: "center",
              width: isMobile ? "100%" : "auto",
            }}
          >
            Sign in
          </MagneticButton>
        </motion.div>
      </div>
    </motion.section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   10. FAQ — pure white background, clipPath top (right-low after coral)
   ════════════════════════════════════════════════════════════════════════ */
const FAQS = [
  {
    q: "Who can join?",
    a:
      "Anyone in India can sign up. Some high-value tasks may have eligibility requirements like prior approvals or account age.",
  },
  {
    q: "How do I get paid?",
    a:
      "Earnings accumulate in your in-app wallet. Once you cross the minimum withdrawal amount, request a payout. UPI hits your account in hours.",
  },
  {
    q: "How long does review take?",
    a:
      "Most submissions are reviewed within 48 hours. You'll get a notification the moment we approve, reject, or need a follow-up.",
  },
  {
    q: "Can a submission be rejected?",
    a:
      "Yes. If it doesn't meet the brief, we reject with feedback. You can usually re-submit after addressing the issues.",
  },
  {
    q: "How are tasks priced?",
    a:
      "Every task lists its reward upfront. No negotiation, no surprise deductions, no platform fee on payout.",
  },
  {
    q: "Is there a referral program?",
    a:
      "Yes. Invite friends, earn a commission on every approved submission they make, plus a join bonus on signup.",
  },
];

function FAQSection({ isMobile }) {
  return (
    <section
      style={{
        position: "relative",
        background: T.canvas, // PLAIN WHITE per spec
        // Top: 40 clip eat + 48 content = 88 mobile / 80 desktop.
        // Bottom: 40 ≥ Footer clip overlap so Q&A pairs aren't covered.
        padding: isMobile ? "88px 0 40px" : "80px 0 40px",
        marginTop: CLIP_OVERLAP,
        clipPath: CLIP_RIGHT_LOW,
        WebkitClipPath: CLIP_RIGHT_LOW,
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <Reveal>
          <Eyebrow style={{ marginBottom: 8 }}>COMMON QUESTIONS</Eyebrow>
        </Reveal>
        <Reveal delay={0.06}>
          <h2
            style={{
              fontFamily: FONT,
              fontSize: isMobile ? 36 : 64,
              fontWeight: 800,
              color: T.ink,
              letterSpacing: "-0.035em",
              lineHeight: 0.98,
              margin: "0 0 24px",
              maxWidth: 800,
            }}
          >
            Quick answers.
          </h2>
        </Reveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
            // Gap 32 between pairs per spec.
            gap: isMobile ? 32 : "32px 64px",
          }}
        >
          {FAQS.map((item, i) => (
            <FAQItem key={item.q} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({ item, index }) {
  const ref = useRef(null);
  const inView = useInView(ref, VIEW_ONCE);
  const reduced = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...SPRING_DEFAULT, delay: index * 0.06 }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 17,
          fontWeight: 700,
          color: T.ink,
          letterSpacing: "-0.015em",
        }}
      >
        {item.q}
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 15,
          lineHeight: 1.6,
          color: T.body,
          marginTop: 6,
        }}
      >
        {item.a}
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   11. FOOTER — ink, clipPath top (left-low after white FAQ above)
   ════════════════════════════════════════════════════════════════════════ */
function Footer({ isMobile }) {
  const reduced = useReducedMotion();
  return (
    <footer
      style={{
        position: "relative",
        background: T.ink,
        // 28 spec padding + 40 clip eat = 68 top. Bottom 28 per spec.
        padding: "68px 0 28px",
        marginTop: CLIP_OVERLAP,
        clipPath: CLIP_LEFT_LOW,
        WebkitClipPath: CLIP_LEFT_LOW,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: isMobile ? 8 : 24,
        }}
      >
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.6, ease: EASE_OUT_QUART }}
          style={{ display: "flex", alignItems: "center", gap: 10 }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            🍣
          </span>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 15,
              fontWeight: 700,
              color: T.onDark,
              letterSpacing: "-0.01em",
            }}
          >
            SushiLabs
          </span>
        </motion.div>

        {/* Desktop links: shown only on desktop per spec */}
        {!isMobile && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: FONT,
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            <Link
              to="/privacy"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Privacy
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              to="/terms"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              Terms
            </Link>
            <span aria-hidden="true">·</span>
            <a
              href="https://x.com/SushiLabs"
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              @SushiLabs
            </a>
          </div>
        )}

        <span
          style={{
            fontFamily: FONT,
            fontSize: 13,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          © {new Date().getFullYear()} SushiLabs. All rights reserved.
        </span>
      </div>
    </footer>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════════════════════════════════ */
export default function Landing() {
  const isMobile = useIsMobile();
  useLandingStyles();

  return (
    <div style={{ background: T.canvas, overflow: "hidden" }}>
      <LandingNav />
      <Hero isMobile={isMobile} />
      <Marquee />
      <Stats isMobile={isMobile} />
      <HowItWorks isMobile={isMobile} />
      <Categories isMobile={isMobile} />
      <WhyUs isMobile={isMobile} />
      <Testimonials isMobile={isMobile} />
      <FinalCTA isMobile={isMobile} />
      <FAQSection isMobile={isMobile} />
      <Footer isMobile={isMobile} />
    </div>
  );
}
