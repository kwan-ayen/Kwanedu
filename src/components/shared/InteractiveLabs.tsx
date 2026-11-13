import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

export function FractionExplorer() {
  const [denominator, setDenominator] = useState(4);
  const [numerator, setNumerator] = useState(3);

  const safeNum = Math.min(numerator, denominator);
  const percentage = Math.round((safeNum / denominator) * 100);

  return (
    <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="text-base font-bold text-slate-900">Interactive Fraction Bar Lab</h4>
          <p className="text-xs text-slate-600">Slide the equal parts and shaded slices to see how fractions work.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDenominator(4);
            setNumerator(3);
          }}
          className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white border border-amber-200 rounded-lg hover:bg-amber-100 flex items-center gap-1.5 whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Shaded Slices (Numerator)</span>
              <span className="tabular-nums">{safeNum}</span>
            </div>
            <input
              type="range"
              min={0}
              max={denominator}
              value={safeNum}
              onChange={(e) => setNumerator(Number(e.target.value))}
              className="w-full accent-amber-600"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Total Equal Parts (Denominator)</span>
              <span className="tabular-nums">{denominator}</span>
            </div>
            <input
              type="range"
              min={2}
              max={10}
              value={denominator}
              onChange={(e) => {
                const nextDen = Number(e.target.value);
                setDenominator(nextDen);
                if (numerator > nextDen) setNumerator(nextDen);
              }}
              className="w-full accent-emerald-600"
            />
          </div>
          <div className="bg-white border border-amber-200 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">Fraction Value</span>
            <span className="text-xl font-bold text-slate-900 tabular-nums">
              {safeNum}/{denominator} ({percentage}%)
            </span>
          </div>
        </div>

        <div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${denominator}, minmax(0, 1fr))` }}>
            {Array.from({ length: denominator }).map((_, idx) => {
              const shaded = idx < safeNum;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNumerator(idx + 1)}
                  className={`h-20 rounded-lg border-2 transition-colors flex items-center justify-center text-xs font-bold ${
                    shaded
                      ? 'bg-amber-400 border-amber-600 text-slate-950'
                      : 'bg-white border-amber-200 text-slate-400 hover:border-amber-400'
                  }`}
                >
                  1/{denominator}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-600 mt-2 text-center">Click any block to shade up to that part.</p>
        </div>
      </div>
    </div>
  );
}

export function OsmosisCellExplorer() {
  const [sucrosePercent, setSucrosePercent] = useState(0);

  const cellState =
    sucrosePercent < 7
      ? {
          label: 'TURGID (Water Enters Cell)',
          color: 'text-emerald-700',
          boxClass: 'bg-emerald-50 border-emerald-300',
          vacuoleScale: 'scale-105',
          note: 'External water potential is higher than cell sap; water moves into the vacuole by osmosis.',
        }
      : sucrosePercent <= 12
      ? {
          label: 'ISOTONIC (Dynamic Equilibrium)',
          color: 'text-teal-800',
          boxClass: 'bg-teal-50/80 border-teal-300',
          vacuoleScale: 'scale-95',
          note: 'Equal water potential inside and outside; zero net change in potato cylinder mass.',
        }
      : {
          label: 'PLASMOLYSED (Water Leaves Cell)',
          color: 'text-amber-700',
          boxClass: 'bg-amber-50/80 border-amber-300',
          vacuoleScale: 'scale-75',
          note: 'External sucrose solution is hypertonic; water exits across the partially permeable membrane.',
        };

  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Plant Cell Osmosis Simulator (S.1–S.4)</h4>
          <p className="text-xs text-slate-600">Adjust external sucrose concentration to observe net water movement.</p>
        </div>
        <span className={`text-xs font-bold ${cellState.color}`}>{cellState.label}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
        <div className="space-y-3">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>External Sucrose Concentration</span>
            <span className="font-mono-tabular">{sucrosePercent}% w/v</span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            value={sucrosePercent}
            onChange={(e) => setSucrosePercent(Number(e.target.value))}
            className="w-full accent-teal-700"
          />
          <p className="text-xs text-slate-700 leading-relaxed bg-white/80 border border-slate-200 rounded-lg p-3">
            {cellState.note}
          </p>
        </div>

        <div className={`border-2 rounded-xl p-6 flex flex-col items-center justify-center transition-colors ${cellState.boxClass}`}>
          <div className="w-44 h-28 border-4 border-slate-700 rounded-2xl flex items-center justify-center bg-white/75 relative">
            <div
              className={`w-32 h-18 rounded-xl bg-teal-200/80 border-2 border-teal-600 flex items-center justify-center transition-transform duration-200 ${cellState.vacuoleScale}`}
            >
              <span className="text-xs font-semibold text-teal-950">Cell Vacuole</span>
            </div>
          </div>
          <span className="text-xs text-slate-600 mt-2 font-medium">
            {sucrosePercent < 7 ? 'Net Flow: Outside → Inside' : sucrosePercent <= 12 ? 'Net Flow: Balanced ↔' : 'Net Flow: Inside → Outside'}
          </span>
        </div>
      </div>
    </div>
  );
}

export function CalculusSlopeExplorer() {
  const [xVal, setXVal] = useState(2);
  const [hVal, setHVal] = useState(1.0);

  const fx = xVal * xVal;
  const fxh = (xVal + hVal) * (xVal + hVal);
  const secantSlope = ((fxh - fx) / hVal).toFixed(3);
  const exactDerivative = (2 * xVal).toFixed(3);

  return (
    <div className="bg-slate-900 text-slate-100 border border-slate-800 rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="font-editorial text-base font-semibold text-white">
            First Principles Limit Explorer: f(x) = x²
          </h4>
          <p className="text-xs text-slate-400">Reduce h toward 0 to observe secant gradient converging to f&apos;(x) = 2x.</p>
        </div>
        <span className="font-mono-tabular text-xs text-amber-300">
          Secant: {secantSlope} · Exact f&apos;({xVal}): {exactDerivative}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Point x</span>
              <span className="font-mono-tabular">{xVal.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={3.5}
              step={0.5}
              value={xVal}
              onChange={(e) => setXVal(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Step Increment h</span>
              <span className="font-mono-tabular">{hVal.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.05}
              max={2.0}
              step={0.05}
              value={hVal}
              onChange={(e) => setHVal(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded p-3 font-mono-tabular text-xs space-y-1">
            <div>[f(x+h) - f(x)] / h = ({fxh.toFixed(2)} - {fx.toFixed(2)}) / {hVal.toFixed(2)} = {secantSlope}</div>
            <div className="text-emerald-400">lim(h→0) = 2({xVal}) = {exactDerivative}</div>
          </div>
        </div>

        <svg viewBox="0 0 260 170" className="w-full h-44 bg-slate-950 border border-slate-800 rounded p-2">
          <line x1="25" y1="150" x2="245" y2="150" stroke="#475569" strokeWidth="1" />
          <line x1="25" y1="15" x2="25" y2="150" stroke="#475569" strokeWidth="1" />
          <path
            d="M 25 150 Q 130 140 230 20"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="2"
          />
          {(() => {
            const toSvgX = (x: number) => 25 + x * 42;
            const toSvgY = (y: number) => 150 - y * 6;
            const x1 = toSvgX(xVal);
            const y1 = Math.max(15, toSvgY(fx));
            const x2 = toSvgX(Math.min(5, xVal + hVal));
            const y2 = Math.max(15, toSvgY(fxh));
            return (
              <>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F59E0B" strokeWidth="2.5" />
                <circle cx={x1} cy={y1} r="4.5" fill="#10B981" />
                <circle cx={x2} cy={y2} r="4" fill="#F59E0B" />
              </>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
