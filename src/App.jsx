import React, { useState, useEffect, useMemo } from "react";
import {
  GlassWater, StretchHorizontal, Dumbbell, Croissant, Wind, BedDouble, SprayCan,
  ShowerHead, ChevronLeft, ChevronRight, Flame, RotateCcw, Home, ShoppingCart,
} from "lucide-react";
import { AppLauncher } from "@capacitor/app-launcher";

// Abrir otra app por package: ejercicio (com.rutina.ejercicio) o Aseo Speedrun
// (com.ritualducha.app). Requiere declararlos en <queries> del AndroidManifest.
// Comida: abrir cámara y compartir la foto al grupo "Comidas" de Telegram.
const captureMeal = (label) => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";
  input.style.display = "none";
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (input.parentNode) input.parentNode.removeChild(input);
    if (!file) return;
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: label });
        return;
      }
    } catch (e) { /* cancelado o no soportado */ }
    try { await AppLauncher.openUrl({ url: "tg://" }); } catch (e) { /* sin Telegram */ }
  };
  document.body.appendChild(input);
  input.click();
};

const openApp = async (pkg) => {
  try { await AppLauncher.openUrl({ url: pkg }); } catch (e) { /* no instalada */ }
};

// -- Paleta dia (invertida de la nocturna) -----------------------
const C = {
  bg: "#FDF6E3",
  panel: "#FFFFFF",
  panelSoft: "#F3ECD6",
  border: "#E7DAB6",
  ink: "#3A3320",
  muted: "#9A8F6B",
  amber: "#E39A2E",
  sunPale: "#FFF3D0",
};

// La mañana es SIEMPRE estiramiento (el ejercicio fuerte pasó a la noche).
// Los días de oficina ese slot pasa a ser Baño (ver morningSlot).
const EST_AM = { key: "ejercicio", label: "Estiramiento", Icon: StretchHorizontal, color: "#5FBFA3", launch: "com.rutina.ejercicio", launchLabel: "Abrir app de ejercicio" };

// Los días de oficina ese slot pasa a ser Baño (en vez del estiramiento/ejercicio).
// Oficina por defecto: jueves (4). Para semanas en que cambia, agregar overrides
// por fecha ISO (YYYY-MM-DD): true = ese día SÍ voy, false = no voy. Mantener en
// sync con RutinaNocturna.
const BANO_AM = { key: "bano", label: "Baño", Icon: ShowerHead, color: "#4FA3D1", launch: "com.ritualducha.app", launchLabel: "Abrir Aseo Speedrun" };
const OFFICE_DOW = new Set([5]);
const OFFICE_OVERRIDES = {
  // Semana del 20/10/2026: esta semana voy el viernes en vez del jueves.
  "2026-10-22": false,
  "2026-10-23": true,
};
const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isOfficeDay = (d) => {
  const o = OFFICE_OVERRIDES[isoDay(d)];
  return o !== undefined ? o : OFFICE_DOW.has(d.getDay());
};
// Estiramiento SOLO lunes(1), miércoles(3) y sábado(6). El resto de los días
// (que no sean de oficina) no tienen estiramiento en la mañana.
const STRETCH_DOW = new Set([1, 3, 6]);
const morningSlot = (d) => {
  if (isOfficeDay(d)) return BANO_AM;
  if (STRETCH_DOW.has(d.getDay())) return EST_AM;
  return null;
};

const habitsForDate = (d) => [
  { key: "tender_cama", label: "Tender cama", Icon: BedDouble, color: "#A78BE0" },
  { key: "desayuno", label: "Desayuno", Icon: Croissant, color: "#D98C4A", meal: true, mealLabel: "Sacar foto y registrar" },
  morningSlot(d),
  { key: "agua", label: "Cargar Agua", Icon: GlassWater, color: "#4FA3D1" },
  { key: "ventilar", label: "Ventilar", Icon: Wind, color: "#7FB3E0" },
  // Limpiar Escritorio todos los días salvo sábado (ese día va Limpiar casa).
  d.getDay() === 6 ? null : { key: "limpiar_escritorio", label: "Limpiar Escritorio", Icon: SprayCan, color: "#C9A227" },
  // Solo los sábados (6): limpieza general y compras, al final de la rutina.
  ...(d.getDay() === 6
    ? [
        { key: "limpiar_casa", label: "Limpiar casa", Icon: Home, color: "#8FB98F", launch: "com.raflos.rutinasdelimpieza", launchLabel: "Abrir Rutinas de limpieza" },
        { key: "hacer_compras", label: "Hacer compras", Icon: ShoppingCart, color: "#D98C4A" },
      ]
    : []),
].filter(Boolean);

const STORAGE_KEY = "morning_routine_data_v1";

// -- Almacenamiento local (localStorage) --------------------------
const storage = {
  async get(key) {
    const value = window.localStorage.getItem(key);
    return value === null ? null : { value };
  },
  async set(key, value) {
    window.localStorage.setItem(key, value);
  },
  async delete(key) {
    window.localStorage.removeItem(key);
  },
};

// -- Helpers de fecha ----------------------------------------------
const toKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const startOfWeek = (d) => {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // 0 = lunes
  return addDays(x, -dow);
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// -- Sol que se llena con la luz ------------------------------------
function Sun({ size, fraction, id }) {
  const r = size / 2;
  const clipId = `sunclip-${id}`;
  const gradId = `sungrad-${id}`;
  const fillH = fraction * size;
  const full = fraction >= 1;
  const rays = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);
  const inner = r - 1;
  const rayStart = r + 3;
  const rayEnd = r + 7;
  return (
    <svg
      width={size + 18}
      height={size + 18}
      viewBox={`${-9} ${-9} ${size + 18} ${size + 18}`}
      style={{ filter: full ? "drop-shadow(0 0 12px rgba(227,154,46,.55))" : "none", transition: "filter .5s" }}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={r} cy={r} r={inner} />
        </clipPath>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF3C4" />
          <stop offset="100%" stopColor="#E39A2E" />
        </linearGradient>
      </defs>
      {rays.map((deg, i) => (
        <line
          key={i}
          x1={r + rayStart * Math.cos((deg * Math.PI) / 180)}
          y1={r + rayStart * Math.sin((deg * Math.PI) / 180)}
          x2={r + rayEnd * Math.cos((deg * Math.PI) / 180)}
          y2={r + rayEnd * Math.sin((deg * Math.PI) / 180)}
          stroke={full ? C.amber : C.border}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ opacity: full ? 1 : 0.5, transition: "opacity .5s, stroke .5s" }}
        />
      ))}
      <circle cx={r} cy={r} r={inner} fill={C.sunPale} stroke={C.border} strokeWidth="1.5" />
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y={size - fillH} width={size} height={fillH} fill={`url(#${gradId})`} style={{ transition: "y .5s ease, height .5s ease" }} />
      </g>
      <circle cx={r} cy={r} r={inner} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1" />
    </svg>
  );
}

export default function App() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState(toKey(today));
  const [weekBase, setWeekBase] = useState(startOfWeek(today));

  // Cargar
  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY);
        if (res && res.value) setData(JSON.parse(res.value));
      } catch (e) {
        // primera vez: sin datos
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (next) => {
    try {
      await storage.set(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      // si falla, el estado en pantalla se mantiene igualmente
    }
  };

  const toggle = (habitKey) => {
    const cur = data[selected] || {};
    const nextDay = { ...cur, [habitKey]: !cur[habitKey] };
    const next = { ...data, [selected]: nextDay };
    setData(next);
    save(next);
  };

  const countFor = (key) => {
    const h = data[key] || {};
    const habits = habitsForDate(new Date(key + "T12:00:00"));
    return habits.reduce((n, x) => n + (h[x.key] ? 1 : 0), 0);
  };
  const totalFor = (key) => habitsForDate(new Date(key + "T12:00:00")).length;

  // Racha de mañanas completas, terminando hoy o ayer
  const streak = useMemo(() => {
    let cursor = new Date(today);
    if (countFor(toKey(today)) < totalFor(toKey(today))) cursor = addDays(cursor, -1);
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const k = toKey(cursor);
      if (countFor(k) === totalFor(k)) {
        n++;
        cursor = addDays(cursor, -1);
      } else break;
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, today]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekBase, i)), [weekBase]);
  const dayLetters = ["L", "M", "X", "J", "V", "S", "D"];

  const selDate = new Date(selected + "T12:00:00");
  const selHabits = habitsForDate(selDate);
  const selCount = countFor(selected);
  const selTotal = selHabits.length;
  const isToday = selected === toKey(today);

  const weekLabel = `${weekDays[0].toLocaleDateString("es-ES", { day: "numeric" })}–${weekDays[6].toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;

  const reset = async () => {
    if (!window.confirm("¿Borrar todo tu progreso? No se puede deshacer.")) return;
    setData({});
    try { await storage.delete(STORAGE_KEY); } catch (e) {}
  };

  if (loading) {
    return (
      <div style={{ ...wrap, alignItems: "center", justifyContent: "center", minHeight: 480 }}>
        <div style={{ color: C.muted, fontFamily: "system-ui" }}>Buenos días…</div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <style>{`
        .mr-tap{ -webkit-tap-highlight-color:transparent; cursor:pointer; }
        .mr-tap:focus-visible{ outline:2px solid ${C.amber}; outline-offset:2px; }
        .mr-row{ transition:background .18s ease, border-color .18s ease; }
        .mr-row:hover{ background:${C.panelSoft}; }
        @media (prefers-reduced-motion: reduce){ *{ transition:none!important; } }
      `}</style>

      {/* nubes tenues */}
      <div style={clouds} aria-hidden>
        {[[14, 26], [74, 18], [88, 52], [30, 58]].map(([l, t], i) => (
          <span key={i} style={{ position: "absolute", left: `${l}%`, top: `${t}px`, width: 26, height: 8, borderRadius: 999, background: "#FFFFFF", opacity: 0.55 }} />
        ))}
      </div>

      {/* encabezado */}
      <header style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontFamily: "'Iowan Old Style','Palatino',Georgia,serif", fontSize: 26, color: C.ink, letterSpacing: 0.3 }}>
          Rutina matutina
        </div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 2, fontFamily: "system-ui" }}>
          {cap(selDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }))}
          {isToday && <span style={{ color: C.amber }}> · hoy</span>}
        </div>
      </header>

      {/* sol + conteo */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, margin: "6px 0 2px", position: "relative", zIndex: 1 }}>
        <Sun size={116} fraction={selCount / selTotal} id="big" />
        <div style={{ fontFamily: "'Iowan Old Style','Palatino',Georgia,serif", fontSize: 20, color: C.ink }}>
          {selCount} <span style={{ color: C.muted }}>/ {selTotal}</span>
        </div>
      </div>

      {/* hábitos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative", zIndex: 1 }}>
        {selHabits.map(({ key, label, Icon, color, launch, launchLabel, meal, mealLabel }) => {
          const done = !!(data[selected] && data[selected][key]);
          const act = () => (meal ? captureMeal(label) : launch ? openApp(launch) : toggle(key));
          return (
            <div
              key={key}
              className="mr-tap mr-row"
              role={launch || meal ? "button" : "checkbox"}
              aria-checked={launch || meal ? undefined : done}
              tabIndex={0}
              onClick={act}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } }}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "13px 14px", borderRadius: 14,
                background: C.panel, border: `1px solid ${done ? color : C.border}`,
              }}
            >
              <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 10, background: done ? color : C.panelSoft, transition: "background .2s" }}>
                <Icon size={18} color={done ? "#FFFFFF" : color} strokeWidth={2} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: C.ink, fontSize: 16, fontFamily: "system-ui", opacity: done ? 1 : 0.85 }}>{label}</span>
                {launch && <span style={{ display: "block", color: C.muted, fontSize: 12, fontFamily: "system-ui", marginTop: 1 }}>{launchLabel}</span>}
                {meal && <span style={{ display: "block", color: C.muted, fontSize: 12, fontFamily: "system-ui", marginTop: 1 }}>{mealLabel}</span>}
              </span>
              <span
                className={launch || meal ? "mr-tap" : undefined}
                role={launch || meal ? "checkbox" : undefined}
                aria-checked={launch || meal ? done : undefined}
                tabIndex={launch || meal ? 0 : undefined}
                aria-label={launch || meal ? `Marcar ${label} como hecho` : undefined}
                onClick={launch || meal ? (e) => { e.stopPropagation(); toggle(key); } : undefined}
                onKeyDown={launch || meal ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggle(key); } } : undefined}
                style={{
                  width: 24, height: 24, borderRadius: 999,
                  border: `2px solid ${done ? color : C.border}`,
                  background: done ? color : "transparent",
                  display: "grid", placeItems: "center", transition: "all .2s", flexShrink: 0,
                }}>
                {done && (
                  <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6.3 5 8.7l4.5-5" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* semana */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: "12px 12px 14px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button className="mr-tap" aria-label="Semana anterior" onClick={() => setWeekBase(addDays(weekBase, -7))} style={navBtn}>
            <ChevronLeft size={18} color={C.muted} />
          </button>
          <span style={{ color: C.ink, fontSize: 13, fontFamily: "system-ui", letterSpacing: 0.3 }}>{weekLabel}</span>
          <button className="mr-tap" aria-label="Semana siguiente" onClick={() => setWeekBase(addDays(weekBase, 7))} style={navBtn}>
            <ChevronRight size={18} color={C.muted} />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {weekDays.map((d, i) => {
            const k = toKey(d);
            const frac = countFor(k) / totalFor(k);
            const isSel = k === selected;
            const isFuture = d > today && k !== toKey(today);
            return (
              <button
                key={k}
                className="mr-tap"
                onClick={() => setSelected(k)}
                aria-label={`Ver ${d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" })}`}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                  background: isSel ? C.panelSoft : "transparent",
                  border: `1px solid ${isSel ? C.amber : "transparent"}`,
                  borderRadius: 12, padding: "7px 0 6px", opacity: isFuture ? 0.4 : 1,
                }}
              >
                <span style={{ fontSize: 11, color: k === toKey(today) ? C.amber : C.muted, fontFamily: "system-ui" }}>{dayLetters[i]}</span>
                <Sun size={22} fraction={frac} id={`w${i}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* racha */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.ink, fontFamily: "system-ui", fontSize: 14 }}>
          <Flame size={18} color={streak > 0 ? C.amber : C.muted} fill={streak > 0 ? C.amber : "none"} />
          {streak > 0 ? (
            <span><b>{streak}</b> {streak === 1 ? "mañana completa" : "mañanas completas"} seguidas</span>
          ) : (
            <span style={{ color: C.muted }}>Completa las {selTotal} para empezar tu racha</span>
          )}
        </div>
        <button className="mr-tap" onClick={reset} aria-label="Borrar datos" style={{ ...navBtn, width: 32, height: 32 }}>
          <RotateCcw size={15} color={C.muted} />
        </button>
      </div>
    </div>
  );
}

const wrap = {
  maxWidth: 420, margin: "0 auto",
  paddingTop: "calc(22px + env(safe-area-inset-top))",
  paddingRight: "calc(18px + env(safe-area-inset-right))",
  paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
  paddingLeft: "calc(18px + env(safe-area-inset-left))",
  display: "flex", flexDirection: "column", gap: 16,
  background: C.bg, borderRadius: 20, position: "relative", overflow: "hidden",
  fontFamily: "system-ui, sans-serif",
};
const clouds = { position: "absolute", inset: 0, height: 120, pointerEvents: "none" };
const navBtn = {
  width: 30, height: 30, borderRadius: 9, border: `1px solid ${C.border}`,
  background: "transparent", display: "grid", placeItems: "center",
  cursor: "pointer", WebkitTapHighlightColor: "transparent",
};
