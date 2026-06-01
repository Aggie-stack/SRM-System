import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import API from "../api";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie, Legend,
} from "recharts";

const MONTH_NAMES  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const INCOME_COLORS  = ["#dc2626","#b91c1c","#991b1b","#7f1d1d","#ef4444","#f87171","#fca5a5","#1a1a1a","#2d2d2d","#404040","#525252","#737373"];
const COURSE_COLORS  = ["#dc2626","#1a1a1a","#b91c1c","#404040","#ef4444","#737373"];
const LEVEL_COLORS   = { Beginner: "#ef4444", Intermediate: "#dc2626", Advanced: "#1a1a1a" };
const PIE_COLORS     = ["#dc2626","#1a1a1a","#b91c1c","#ef4444","#737373"];

// ── Mode of study: canonical keys the API might return ──────────────────────
// Normalise to "Online" or "Physical" regardless of casing / spacing.
const MODE_LABELS = {
  online:   "Online",
  physical: "Physical",
  "in-person": "Physical",
  inperson: "Physical",
  offline:  "Physical",
  "on-site": "Physical",
  onsite:   "Physical",
};
const MODE_COLORS = { Online: "#dc2626", Physical: "#1a1a1a" };

/**
 * Collapse raw mode_gender array into exactly two buckets:
 * { name: "Online", value: N } and { name: "Physical", value: N }
 */
function normaliseModeData(rawArray) {
  if (!Array.isArray(rawArray) || rawArray.length === 0) return [];

  const buckets = { Online: 0, Physical: 0 };

  rawArray.forEach((item) => {
    const key = (item.name ?? item.mode ?? "").toLowerCase().trim().replace(/\s+/g, "");
    const canonical = MODE_LABELS[key];
    const count = Number(item.value ?? item.count ?? 0);

    if (canonical) {
      buckets[canonical] += count;
    } else {
      // Fallback: anything unrecognised that contains "online" → Online, else Physical
      if (key.includes("online")) {
        buckets.Online += count;
      } else {
        buckets.Physical += count;
      }
    }
  });

  return Object.entries(buckets)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));
}

const DEFAULT_DATA = {
  total_students: 0, total_income: 0,
  active_students: 0, expired_students: 0, unsubscribed_students: 0,
  male_students: 0, female_students: 0,
  classes: [], mode_gender: [], level_gender: [],
};

const FIRST_YEAR   = 2026;
const getThisYear  = () => new Date().getFullYear();
const getYearRange = () => {
  const current = getThisYear();
  return Array.from({ length: current - FIRST_YEAR + 1 }, (_, i) => current - i);
};

const formatKES = (v) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(v);
const formatNum = (v) => new Intl.NumberFormat("en-KE").format(v);
const initials  = (name = "") => name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const AVATAR_BG   = ["#dc2626","#1a1a1a","#b91c1c","#404040","#ef4444","#525252","#991b1b","#2d2d2d"];
const avatarColor = (name = "") => {
  let h = 0;
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length];
};

const STAT_CARDS = [
  { key: "total_students",        label: "Total Students",  icon: "👥", variant: "outline-dark" },
  { key: "active_students",       label: "Active",          icon: "✅", variant: "outline-green", sub: "Subscription valid" },
  { key: "expired_students",      label: "Expired",         icon: "⏰", variant: "outline-red",   sub: "Lapsed < 30 days" },
  { key: "unsubscribed_students", label: "Unsubscribed",    icon: "🚫", variant: "outline-dark",  sub: "Lapsed 30+ days" },
  { key: "male_students",         label: "Male",            icon: "♂",  variant: "outline-dark" },
  { key: "female_students",       label: "Female",          icon: "♀",  variant: "solid-red" },
];

const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  .db * { box-sizing: border-box; font-family: 'Inter', sans-serif; }

  .db {
    background: #f4f4f5;
    padding: 20px 16px 48px;
    min-height: 100vh;
  }

  /* ── Header ── */
  .db-header {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 10px;
    margin-bottom: 20px;
  }
  .db-title-wrap { display: flex; align-items: center; gap: 10px; }
  .db-logo {
    width: 40px; height: 40px; border-radius: 11px;
    background: #dc2626;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(220,38,38,.35);
  }
  .db-title { margin:0; font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -.03em; }
  .db-subtitle { font-size: 12px; color: #6b7280; font-weight: 500; margin-top: 1px; }

  /* ── Period badge ── */
  .period-pill {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 5px 12px; border-radius: 99px;
    font-size: 11px; font-weight: 700; letter-spacing: .01em;
    white-space: nowrap;
  }
  .period-year  { background: #dc2626; color: #fff; }
  .period-month { background: #111827; color: #fff; }

  /* ── Filter bar ── */
  .filter-bar {
    display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
    margin-bottom: 20px;
  }

  .ftab {
    padding: 7px 14px; border-radius: 99px;
    border: 1.5px solid #e5e7eb; background: #fff;
    font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all .15s; color: #6b7280;
    display: flex; align-items: center; gap: 5px;
    white-space: nowrap;
  }
  .ftab:hover { border-color: #d1d5db; color: #111827; }
  .ftab.year-on  { background: #dc2626; border-color: #dc2626; color: #fff; box-shadow: 0 2px 8px rgba(220,38,38,.3); }
  .ftab.month-on { background: #111827; border-color: #111827; color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.25); }

  .fselect {
    padding: 7px 12px; border-radius: 99px;
    border: 1.5px solid #e5e7eb; background: #fff;
    font-size: 12px; font-weight: 600; color: #111827;
    outline: none; cursor: pointer; transition: border-color .15s;
    max-width: 160px;
  }
  .fselect:hover  { border-color: #dc2626; }
  .fselect:focus  { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,.12); }

  .fdiv { color: #d1d5db; font-size: 16px; user-select: none; }

  /* ── Year dropdown ── */
  .year-select-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .year-select-wrap .year-icon {
    position: absolute; left: 11px;
    font-size: 13px; pointer-events: none; z-index: 1;
  }
  .year-dropdown {
    padding: 7px 32px 7px 30px;
    border-radius: 99px;
    border: 1.5px solid #dc2626;
    background: #fff;
    font-size: 12px; font-weight: 700; color: #dc2626;
    outline: none; cursor: pointer; transition: all .15s;
    appearance: none; -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%23dc2626' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 11px center;
    box-shadow: 0 1px 4px rgba(220,38,38,.15);
    min-width: 100px;
  }
  .year-dropdown:hover  { background-color: #fff5f5; box-shadow: 0 2px 8px rgba(220,38,38,.25); }
  .year-dropdown:focus  { box-shadow: 0 0 0 3px rgba(220,38,38,.15); }

  /* ── Hero income card ── */
  .income-hero {
    background: #dc2626; border-radius: 18px;
    padding: 22px 24px; margin-bottom: 16px;
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 12px;
    position: relative; overflow: hidden;
    box-shadow: 0 4px 20px rgba(220,38,38,.35);
  }
  .income-hero::before {
    content: ''; position: absolute; top: -40px; right: -40px;
    width: 180px; height: 180px; border-radius: 50%;
    background: rgba(255,255,255,.07); pointer-events: none;
  }
  .income-hero::after {
    content: ''; position: absolute; bottom: -50px; right: 60px;
    width: 140px; height: 140px; border-radius: 50%;
    background: rgba(255,255,255,.05); pointer-events: none;
  }
  .income-hero-label { font-size: 12px; font-weight: 600; color: rgba(255,255,255,.75); letter-spacing: .04em; text-transform: uppercase; margin-bottom: 5px; }
  .income-hero-value { font-size: 34px; font-weight: 900; color: #fff; letter-spacing: -.04em; line-height: 1; }
  .income-hero-sub   { font-size: 11px; color: rgba(255,255,255,.6); margin-top: 5px; font-weight: 500; }
  .income-hero-icon  { font-size: 40px; opacity: .9; position: relative; z-index: 1; }

  /* ── Stat grid ── */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px; margin-bottom: 18px;
  }
  .stat-card {
    background: #fff; border-radius: 14px;
    padding: 14px 12px 12px;
    border: 1.5px solid #e5e7eb;
    display: flex; flex-direction: column; gap: 5px;
    transition: transform .18s, box-shadow .18s;
    cursor: default;
  }
  .stat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.08); }
  .stat-card.solid-red { background: #111827; border-color: #111827; }
  .stat-card.solid-red .sc-label { color: rgba(255,255,255,.6); }
  .stat-card.solid-red .sc-value { color: #fff; }
  .stat-card.solid-red .sc-sub   { color: rgba(255,255,255,.45); }
  .stat-card.outline-red   { border-color: #fca5a5; }
  .stat-card.outline-green { border-color: #bbf7d0; }

  .sc-icon  { font-size: 18px; line-height: 1; margin-bottom: 2px; }
  .sc-label { font-size: 10px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: #9ca3af; }
  .sc-value { font-size: 22px; font-weight: 800; letter-spacing: -.03em; color: #111827; line-height: 1.1; }
  .sc-sub   { font-size: 10px; color: #9ca3af; font-weight: 500; margin-top: -2px; }
  .sc-dot   { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 3px; vertical-align: middle; }

  /* ── Chart card ── */
  .cc {
    background: #fff; border-radius: 16px;
    border: 1.5px solid #e5e7eb;
    padding: 18px 16px 14px;
    box-shadow: 0 1px 4px rgba(0,0,0,.04);
    transition: box-shadow .18s;
  }
  .cc:hover { box-shadow: 0 4px 16px rgba(0,0,0,.07); }
  .cc-title {
    margin: 0 0 14px; font-size: 13px; font-weight: 700;
    color: #111827; display: flex; align-items: center; gap: 7px;
  }
  .cc-title-dot { width: 4px; height: 16px; border-radius: 2px; background: #dc2626; flex-shrink: 0; }
  .cc-title-text { flex: 1; }
  .cc-badge { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 6px; background: #fee2e2; color: #991b1b; }

  /* ── Mode of study legend chips ── */
  .mode-chips {
    display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;
  }
  .mode-chip {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 99px;
    font-size: 11px; font-weight: 700;
  }
  .mode-chip-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

  /* ── Status legend ── */
  .status-strip {
    background: #fff; border: 1.5px solid #e5e7eb; border-radius: 11px;
    padding: 9px 14px; margin-bottom: 16px;
    display: flex; gap: 14px; flex-wrap: wrap; align-items: center;
    font-size: 11px; font-weight: 600; color: #374151;
  }
  .sl-label { font-weight: 700; color: #111827; font-size: 11px; }
  .sl-item  { display: flex; align-items: center; gap: 4px; }
  .sl-dot   { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

  /* ── Renewal rows ── */
  .ren-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 9px 10px; border-radius: 10px;
    border: 1.5px solid #e5e7eb; background: #fff;
    transition: border-color .15s, background .15s;
  }
  .ren-row:hover { border-color: #d1d5db; }
  .ren-row.urgent { border-color: #fca5a5; background: #fff5f5; }

  /* ── Avatar ── */
  .av {
    width: 34px; height: 34px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 11px; font-weight: 700; flex-shrink: 0;
  }

  /* ── Enrolment bars ── */
  .eb-track { flex: 1; height: 7px; background: #f3f4f6; border-radius: 6px; overflow: hidden; }
  .eb-fill  { height: 100%; border-radius: 6px; transition: width .4s ease; }

  /* ── Notices ── */
  .notice {
    display: flex; align-items: flex-start; gap: 8px;
    border-radius: 11px; padding: 10px 14px;
    font-size: 12px; font-weight: 600; margin-bottom: 16px;
    line-height: 1.5;
  }
  .notice-red   { background: #fff5f5; border: 1.5px solid #fca5a5; color: #991b1b; }
  .notice-dark  { background: #f9fafb; border: 1.5px solid #e5e7eb; color: #374151; }

  /* ── Empty state ── */
  .empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: #d1d5db; font-size: 12px; text-align: center; padding: 0 12px; gap: 7px;
  }
  .empty-icon { font-size: 26px; }

  /* ── Skeleton ── */
  .skel {
    background: linear-gradient(90deg,#f3f4f6 25%,#fafafa 50%,#f3f4f6 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite; border-radius: 14px;
  }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* ── Section divider ── */
  .section-label {
    font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    color: #9ca3af; margin: 0 0 10px; display: flex; align-items: center; gap: 8px;
  }
  .section-label::after { content: ''; flex: 1; height: 1px; background: #e5e7eb; }

  /* ════════════════════════════════════════
     RESPONSIVE — tablet (≤768px)
  ════════════════════════════════════════ */
  @media (max-width: 768px) {
    .db { padding: 16px 12px 48px; }

    .db-header { margin-bottom: 16px; }
    .db-title  { font-size: 18px; }

    .filter-bar { gap: 6px; margin-bottom: 16px; }
    .ftab       { padding: 6px 12px; font-size: 11px; }
    .fselect    { font-size: 11px; padding: 6px 10px; max-width: 140px; }
    .year-dropdown { font-size: 11px; min-width: 90px; }

    .income-hero       { padding: 18px 20px; border-radius: 16px; }
    .income-hero-value { font-size: 28px; }
    .income-hero-icon  { font-size: 34px; }

    .stat-grid { grid-template-columns: repeat(2, 1fr); gap: 9px; }

    /* Engagement row: stack to single column */
    .engage-grid { grid-template-columns: 1fr !important; }

    /* Performance row: stack */
    .perf-grid { grid-template-columns: 1fr !important; }
  }

  /* ════════════════════════════════════════
     RESPONSIVE — mobile (≤480px)
  ════════════════════════════════════════ */
  @media (max-width: 480px) {
    .db { padding: 14px 10px 48px; }

    .db-logo    { width: 36px; height: 36px; font-size: 18px; }
    .db-title   { font-size: 16px; }
    .db-subtitle { font-size: 11px; }
    .period-pill { font-size: 10px; padding: 4px 10px; }

    .filter-bar { gap: 5px; }
    .ftab       { padding: 6px 10px; font-size: 11px; gap: 3px; }
    .fselect    { font-size: 11px; padding: 6px 9px; max-width: 130px; }
    .year-dropdown { font-size: 11px; min-width: 85px; padding: 6px 28px 6px 26px; }

    .income-hero       { padding: 16px 18px; }
    .income-hero-label { font-size: 11px; }
    .income-hero-value { font-size: 24px; }
    .income-hero-sub   { font-size: 10px; }
    .income-hero-icon  { font-size: 30px; }

    .stat-grid  { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .sc-value   { font-size: 20px; }
    .sc-label   { font-size: 9px; }

    .status-strip { gap: 10px; padding: 8px 12px; font-size: 10px; }
    .sl-label     { font-size: 10px; }

    .cc          { padding: 14px 12px 12px; border-radius: 14px; }
    .cc-title    { font-size: 12px; margin-bottom: 10px; }

    .section-label { font-size: 9px; }

    .notice { font-size: 11px; padding: 9px 12px; }

    .ren-row .av { width: 30px; height: 30px; font-size: 10px; }
  }
`;

function YearDropdown({ year, onChange }) {
  const yearRange = getYearRange();
  return (
    <div className="year-select-wrap">
      <span className="year-icon">📅</span>
      <select
        className="year-dropdown"
        value={year}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {yearRange.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}

function Skeleton() {
  return (
    <>
      <div style={{ display:"flex", gap:10, marginBottom:16 }}>
        <div className="skel" style={{ height:100, flex:1 }} />
        <div className="skel" style={{ height:100, flex:1 }} />
        <div className="skel" style={{ height:100, flex:1 }} />
      </div>
      <div className="stat-grid">
        {[...Array(6)].map((_, i) => <div key={i} className="skel" style={{ height:90 }} />)}
      </div>
      {[280,260,320].map((h, i) => (
        <div key={i} className="skel" style={{ height:h, marginBottom:12 }} />
      ))}
    </>
  );
}

function EmptyState({ height=120, msg }) {
  return (
    <div className="empty" style={{ height }}>
      <span className="empty-icon">📭</span>
      <span>{msg}</span>
    </div>
  );
}

function PickMonthPlaceholder({ height=160 }) {
  return (
    <div className="empty" style={{ height }}>
      <span className="empty-icon">📆</span>
      <span>Select a month above to see data</span>
    </div>
  );
}

function IncomeHero({ value, year, month, viewMode }) {
  const sub = viewMode === "month" && month
    ? `${MONTHS_FULL[month - 1]} ${year}`
    : `January – December ${year}`;
  return (
    <div className="income-hero">
      <div>
        <div className="income-hero-label">💰 Total Income</div>
        <div className="income-hero-value">{formatKES(value)}</div>
        <div className="income-hero-sub">{sub}</div>
      </div>
      <div className="income-hero-icon">💵</div>
    </div>
  );
}

function StatusStrip() {
  return (
    <div className="status-strip">
      <span className="sl-label">Status:</span>
      <span className="sl-item"><span className="sl-dot" style={{ background:"#1a1a1a" }} />Active</span>
      <span className="sl-item"><span className="sl-dot" style={{ background:"#dc2626" }} />Expired &lt;30d</span>
      <span className="sl-item"><span className="sl-dot" style={{ background:"#9ca3af" }} />Unsub 30d+</span>
    </div>
  );
}

function StatCards({ data }) {
  return (
    <div className="stat-grid">
      {STAT_CARDS.map(({ key, label, icon, variant, sub }) => {
        const raw = data[key];
        const display = formatNum(raw);
        const dotColor = key === "active_students" ? "#22c55e"
          : key === "expired_students" ? "#dc2626"
          : key === "unsubscribed_students" ? "#9ca3af" : null;
        return (
          <div key={key} className={`stat-card ${variant}`}>
            <span className="sc-icon">{icon}</span>
            <span className="sc-label">{label}</span>
            <span className="sc-value">{display}</span>
            {sub && (
              <span className="sc-sub">
                {dotColor && <span className="sc-dot" style={{ background: dotColor }} />}
                {sub}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Custom legend for the mode pie showing Online / Physical counts ──────────
function ModeLegend({ data }) {
  return (
    <div className="mode-chips">
      {data.map((entry) => (
        <span key={entry.name} className="mode-chip"
          style={{ background: MODE_COLORS[entry.name] ? `${MODE_COLORS[entry.name]}18` : "#f3f4f6",
                   color: MODE_COLORS[entry.name] ?? "#374151",
                   border: `1.5px solid ${MODE_COLORS[entry.name] ?? "#e5e7eb"}` }}>
          <span className="mode-chip-dot"
            style={{ background: MODE_COLORS[entry.name] ?? "#9ca3af" }} />
          {entry.name} · {formatNum(entry.value)}
        </span>
      ))}
    </div>
  );
}

function ColoredPie({ rawData, height=200, needsMonthSelection=false }) {
  if (needsMonthSelection) return <PickMonthPlaceholder height={height} />;

  // Normalise: collapse all variants into Online / Physical
  const data = normaliseModeData(rawData);
  const hasData = data.length > 0 && data.some((d) => d.value > 0);
  if (!hasData) return <EmptyState height={height} msg="No study mode data for this period." />;

  // Assign colours deterministically: Online → red, Physical → dark
  const coloredData = data.map((d) => ({ ...d, fill: MODE_COLORS[d.name] ?? PIE_COLORS[0] }));

  return (
    <>
      <ModeLegend data={coloredData} />
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={coloredData} dataKey="value" nameKey="name" cx="50%" cy="45%"
            outerRadius={65} innerRadius={28} label={false} paddingAngle={4}>
            {coloredData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, name) => [formatNum(v), name]}
            contentStyle={{ borderRadius:10, border:"1px solid #e5e7eb", fontSize:11, boxShadow:"0 4px 16px rgba(0,0,0,.08)" }}
          />
          <Legend iconSize={7} wrapperStyle={{ fontSize:10, lineHeight:"17px", paddingTop:4 }} />
        </PieChart>
      </ResponsiveContainer>
    </>
  );
}

function IncomeChart({ data, viewMode, month }) {
  let chartData;
  if (viewMode === "month" && month) {
    const found = data.find((d) => d.name === MONTH_NAMES[month - 1]);
    chartData = [{ name: MONTH_NAMES[month - 1], income: found?.income ?? 0 }];
  } else {
    const map = {};
    data.forEach((d) => { map[d.name] = d.income; });
    chartData = MONTH_NAMES.map((m) => ({ name: m, income: map[m] ?? 0 }));
  }
  const hasData = chartData.some((d) => d.income > 0);
  if (!hasData) return <EmptyState height={260} msg="No income recorded for this period." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top:8, right:8, left:8, bottom:24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis dataKey="name"
          label={{ value:"Month", position:"insideBottom", offset:-14, style:{ fontSize:11, fill:"#9ca3af", fontWeight:600 } }}
          tick={{ fontSize:11, fill:"#6b7280" }} axisLine={false} tickLine={false}
        />
        <YAxis allowDecimals={false} tickFormatter={formatNum} width={60}
          label={{ value:"KES", angle:-90, position:"insideLeft", offset:0, style:{ fontSize:10, fill:"#9ca3af", fontWeight:600 } }}
          tick={{ fontSize:10, fill:"#9ca3af" }} axisLine={false} tickLine={false}
        />
        <Tooltip formatter={(v) => [formatKES(v), "Income"]}
          contentStyle={{ borderRadius:10, border:"1px solid #e5e7eb", fontSize:11, boxShadow:"0 4px 16px rgba(0,0,0,.08)" }}
          cursor={{ fill:"rgba(220,38,38,.06)" }}
        />
        <Bar dataKey="income" radius={[6,6,0,0]} maxBarSize={44}>
          {chartData.map((entry, i) => (
            <Cell key={entry.name} fill={INCOME_COLORS[i % INCOME_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const LEVEL_ORDER = ["Beginner","Intermediate","Advanced"];

function StudentLevelsChart({ data, needsMonthSelection=false }) {
  if (needsMonthSelection) return <PickMonthPlaceholder height={220} />;
  const normalised = LEVEL_ORDER.map((lvl) => {
    const found = data.find((d) => (d.name||"").toLowerCase() === lvl.toLowerCase());
    return { name: lvl, value: found?.value ?? 0 };
  });
  const hasData = normalised.some((d) => d.value > 0);
  if (!hasData) return <EmptyState height={220} msg="No student level data for this period." />;

  const CustomLabel = ({ x, y, width, value }) =>
    value > 0 ? (
      <text x={x + width/2} y={y - 5} textAnchor="middle" fill="#111827" fontSize={12} fontWeight={700}>{value}</text>
    ) : null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={normalised} margin={{ top:24, right:8, left:0, bottom:24 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
        <XAxis dataKey="name"
          label={{ value:"Level", position:"insideBottom", offset:-14, style:{ fontSize:11, fill:"#9ca3af", fontWeight:600 } }}
          tick={{ fontSize:12, fill:"#6b7280", fontWeight:600 }} axisLine={false} tickLine={false}
        />
        <YAxis allowDecimals={false} tickCount={5} width={36}
          label={{ value:"Students", angle:-90, position:"insideLeft", offset:12, style:{ fontSize:10, fill:"#9ca3af", fontWeight:600 } }}
          tick={{ fontSize:10, fill:"#9ca3af" }} axisLine={false} tickLine={false}
        />
        <Tooltip formatter={(v) => [v, "Students"]} cursor={{ fill:"rgba(220,38,38,.06)" }}
          contentStyle={{ borderRadius:10, border:"1px solid #e5e7eb", fontSize:11 }} />
        <Bar dataKey="value" radius={[6,6,0,0]} maxBarSize={72} label={<CustomLabel />}>
          {normalised.map((entry) => (
            <Cell key={entry.name} fill={LEVEL_COLORS[entry.name] ?? "#1a1a1a"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EnrolmentByCourse({ courses, needsMonthSelection=false }) {
  const max = Math.max(...(courses||[]).map((c) => c.count), 1);
  return (
    <div className="cc">
      <div className="cc-title">
        <span className="cc-title-dot" />
        <span className="cc-title-text">Enrolment by Course</span>
        {courses?.length > 0 && <span className="cc-badge">{courses.length} courses</span>}
      </div>
      {needsMonthSelection ? <PickMonthPlaceholder height={100} /> :
       !courses?.length ? <EmptyState height={100} msg="No course enrolments for this period." /> : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {courses.map((course, i) => (
            <div key={course.name} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{
                width:26, height:26, borderRadius:7,
                background: COURSE_COLORS[i % COURSE_COLORS.length],
                display:"flex", alignItems:"center", justifyContent:"center",
                flexShrink:0, color:"#fff", fontSize:10, fontWeight:700,
              }}>
                {(i+1).toString().padStart(2,"0")}
              </div>
              <span style={{ width:90, fontSize:12, color:"#6b7280", flexShrink:0, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {course.name}
              </span>
              <div className="eb-track">
                <div className="eb-fill" style={{ width:`${(course.count/max)*100}%`, background: COURSE_COLORS[i % COURSE_COLORS.length] }} />
              </div>
              <span style={{ width:24, textAlign:"right", fontSize:12, fontWeight:700, color:"#111827", flexShrink:0 }}>
                {course.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RenewalsDueSoon({ renewals }) {
  return (
    <div className="cc">
      <div className="cc-title">
        <span className="cc-title-dot" />
        <span className="cc-title-text">Renewals Due Soon</span>
        {renewals?.length > 0 && <span className="cc-badge">{renewals.length}</span>}
      </div>
      {!renewals?.length ? <EmptyState height={70} msg="No renewals due in the next 7 days." /> : (
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          {renewals.map((s) => {
            const daysLeft = Math.ceil((new Date(s.due_date) - new Date()) / 86400000);
            const urgent   = daysLeft <= 3;
            return (
              <div key={`${s.student_id}-${s.due_date}`} className={`ren-row${urgent ? " urgent" : ""}`}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div className="av" style={{ background: avatarColor(s.student_name) }}>{initials(s.student_name)}</div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:"#111827" }}>{s.student_name}</div>
                    <div style={{ fontSize:10, color:"#9ca3af" }}>#{s.student_id} · {s.course}</div>
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:11, fontWeight:800, color: urgent ? "#dc2626" : "#374151" }}>
                    {daysLeft <= 0 ? "Today!" : `${daysLeft}d`}
                  </div>
                  <div style={{ fontSize:10, color:"#9ca3af" }}>
                    {new Date(s.due_date).toLocaleDateString("en-KE", { day:"numeric", month:"short" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecentPayments({ payments }) {
  return (
    <div className="cc">
      <div className="cc-title">
        <span className="cc-title-dot" />
        <span className="cc-title-text">Recent Payments</span>
      </div>
      {!payments?.length ? <EmptyState height={70} msg="No recent payments found." /> : (
        <div style={{ display:"flex", flexDirection:"column" }}>
          {payments.map((p, i) => (
            <div key={`${p.id}-${p.date_paid}`} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"9px 0",
              borderBottom: i < payments.length - 1 ? "1px solid #f3f4f6" : "none",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div className="av" style={{ background: avatarColor(p.student_name) }}>{initials(p.student_name)}</div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#111827" }}>{p.student_name}</div>
                  <div style={{ fontSize:10, color:"#9ca3af" }}>
                    {p.course} · {p.duration}mo · {new Date(p.date_paid).toLocaleDateString("en-KE", { day:"numeric", month:"short" })}
                  </div>
                </div>
              </div>
              <div style={{ fontSize:12, fontWeight:800, color:"#dc2626", whiteSpace:"nowrap", flexShrink:0, marginLeft:8 }}>
                {formatKES(p.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Dashboard({ refresh }) {
  const [month,         setMonth]         = useState(null);
  const [year,          setYear]          = useState(getThisYear);
  const [viewMode,      setViewMode]      = useState("year");
  const [paymentFilter, setPaymentFilter] = useState("7");

  const activeMonth         = viewMode === "month" && month ? month : null;
  const needsMonthSelection = viewMode === "month" && !month;

  const token  = localStorage.getItem("token");
  const params = { year, ...(activeMonth ? { month: activeMonth } : {}) };
  const headers = { Authorization: `Bearer ${token}` };

  // ── Cached queries ──────────────────────────────────────────────
  const { data: dashRaw,    isLoading: l1 } = useQuery({
    queryKey: ["dashboard", year, activeMonth],
    queryFn:  () => API.get("/dashboard", { params, headers }).then(r => r.data),
    enabled:  !needsMonthSelection,
    staleTime: 5 * 60 * 1000,
  });

  const { data: coursesRaw, isLoading: l2 } = useQuery({
    queryKey: ["dashboard-courses", year, activeMonth],
    queryFn:  () => API.get("/dashboard/courses", { params, headers }).then(r => r.data),
    enabled:  !needsMonthSelection,
    staleTime: 5 * 60 * 1000,
  });

  const { data: renewalsRaw, isLoading: l3 } = useQuery({
    queryKey: ["dashboard-renewals"],
    queryFn:  () => API.get("/dashboard/renewals-due", { headers }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: paymentsRaw, isLoading: l4 } = useQuery({
    queryKey: ["dashboard-payments", paymentFilter],
    queryFn:  () => API.get("/dashboard/recent-payments", { params: { days: paymentFilter }, headers }).then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  // ── Derived state ───────────────────────────────────────────────
  const data     = { ...DEFAULT_DATA, ...(dashRaw ?? {}) };
  const courses  = Array.isArray(coursesRaw)  ? coursesRaw  : [];
  const renewals = Array.isArray(renewalsRaw) ? renewalsRaw : [];
  const payments = Array.isArray(paymentsRaw) ? paymentsRaw : [];
  const loading  = l1 || l2 || l3 || l4;

  // Also re-fetch when parent triggers refresh
  const queryClient = useQueryClient();
  useEffect(() => {
    if (refresh) {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-courses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-renewals"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-payments"] });
    }
  }, [refresh]);

  const switchToYear  = () => { setViewMode("year");  setMonth(null); setYear(getThisYear()); };
  const switchToMonth = () => { setViewMode("month"); setMonth(null); };

  const periodLabel = viewMode === "year"
    ? `Full Year ${year}`
    : month ? `${MONTHS_FULL[month - 1]} ${year}` : `Month View ${year}`;

  const isMonthScoped = viewMode === "month" && !!month;

  // ── JSX is exactly the same as before ──────────────────────────
  return (
    <>
      <style>{GLOBAL_STYLE}</style>
      <div className="db">
        {/* Header */}
        <div className="db-header">
          <div className="db-title-wrap">
            <div className="db-logo">📊</div>
            <div>
              <h2 className="db-title">Dashboard</h2>
              <div className="db-subtitle">Overview &amp; Analytics</div>
            </div>
          </div>
          <span className={`period-pill ${viewMode === "year" ? "period-year" : "period-month"}`}>
            {viewMode === "year" ? "📅" : "📆"} {periodLabel}
          </span>
        </div>

        {/* Filter bar */}
        <div className="filter-bar">
          <button className={`ftab${viewMode==="year" ? " year-on" : ""}`} onClick={switchToYear}>
            📅 Year
          </button>
          <button className={`ftab${viewMode==="month" ? " month-on" : ""}`} onClick={switchToMonth}>
            📆 Month
          </button>
          <YearDropdown year={year} onChange={(y) => { setYear(y); setMonth(null); }} />
          {viewMode === "month" && (
            <select className="fselect" value={month ?? ""} onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Pick month —</option>
              {MONTHS_FULL.map((name, i) => <option key={i+1} value={i+1}>{name}</option>)}
            </select>
          )}
          <span className="fdiv">|</span>
          <select className="fselect" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
            <option value="7">Payments in 7days</option>
            <option value="30">Payments 30d</option>
            <option value="all">All time</option>
          </select>
        </div>

        {/* Notices */}
        {needsMonthSelection && (
          <div className="notice notice-dark">
            📆 Select a month above to see month-specific stats.
          </div>
        )}
        {isMonthScoped && (
          <div className="notice notice-red">
            📆 Showing <strong>{MONTHS_FULL[month - 1]} {year}</strong> — figures reflect students who paid this month.
          </div>
        )}

        {loading ? <Skeleton /> : (
          <>
            {!needsMonthSelection && (
              <>
                <IncomeHero value={data.total_income} year={year} month={month} viewMode={viewMode} />
                <StatusStrip />
                <p className="section-label">Students overview</p>
                <StatCards data={data} />
              </>
            )}
            <p className="section-label">Engagement</p>
            <div className="engage-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16, alignItems:"start" }}>
              <div className="cc">
                <div className="cc-title">
                  <span className="cc-title-dot" />
                  <span className="cc-title-text">Mode of Study</span>
                  {!needsMonthSelection && (() => {
                    const nd = normaliseModeData(data.mode_gender);
                    const total = nd.reduce((s, d) => s + d.value, 0);
                    return total > 0 ? <span className="cc-badge">{formatNum(total)} students</span> : null;
                  })()}
                </div>
                <ColoredPie rawData={data.mode_gender} height={200} needsMonthSelection={needsMonthSelection} />
              </div>
              <EnrolmentByCourse courses={courses} needsMonthSelection={needsMonthSelection} />
              <RecentPayments payments={payments} />
            </div>
            <p className="section-label">Performance</p>
            <div className="perf-grid" style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12, marginBottom:16, alignItems:"start" }}>
              <div className="cc">
                <div className="cc-title">
                  <span className="cc-title-dot" />
                  <span className="cc-title-text">Student Levels</span>
                </div>
                <StudentLevelsChart data={data.level_gender} needsMonthSelection={needsMonthSelection} />
              </div>
              <RenewalsDueSoon renewals={renewals} />
            </div>
            {!needsMonthSelection && (
              <>
                <p className="section-label">Income</p>
                <div className="cc">
                  <div className="cc-title">
                    <span className="cc-title-dot" />
                    <span className="cc-title-text">
                      {isMonthScoped ? `Income — ${MONTHS_FULL[month - 1]} ${year}` : `Monthly income breakdown — ${year}`}
                    </span>
                  </div>
                  <IncomeChart data={data.classes} viewMode={viewMode} month={month} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default Dashboard;