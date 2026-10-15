'use client';

import { useRef, useState } from 'react';
import { MAP_POINTS } from '@/lib/venue-map';
import { Close, MapIcon } from './icons';

export type MapPlace = { key: string; label: string; activities: string[] };
type Text = { map: string; mapTitle: string; close: string; yourNext: string; entrance: string };

/** "Map" button for the Up next card; opens a sheet with the (placeholder) grounds map. */
export default function VenueMap({ places, current, text, zh }: { places: MapPlace[]; current: string; text: Text; zh: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [sel, setSel] = useState(current);
  const open = () => { setSel(current); ref.current?.showModal(); ref.current?.scrollTo(0, 0); };
  const close = () => ref.current?.close();
  const pinned = places.filter((p) => MAP_POINTS[p.key]);

  return (
    <>
      <button type="button" className="mapbtn" onClick={open}><MapIcon /> {text.map}</button>
      <dialog ref={ref} className="mapsheet" aria-labelledby="map-title" onClick={(e) => { if (e.target === ref.current) close(); }}>
        <div className="mapsheet-head">
          <h2 id="map-title" className="h2" style={{ fontSize: 21 }}>{text.mapTitle}</h2>
          <button type="button" className="round" aria-label={text.close} onClick={close}><Close /></button>
        </div>

        <svg viewBox="0 0 360 420" className="mapsvg" role="img" aria-label={text.mapTitle}>
          <rect width="360" height="420" rx="20" fill="#E8EADB" />
          {/* forest */}
          <g fill="#B5C7A3">
            {[[30,40,22],[62,28,18],[100,36,24],[140,30,17],[44,84,20],[150,76,20],[30,128,18],[70,128,15],[118,120,17],[165,118,13],[178,48,14]].map(([x,y,r],i)=> <circle key={i} cx={x} cy={y} r={r} />)}
          </g>
          <g fill="#9DB48B">
            {[[52,54,10],[118,58,12],[84,100,9],[140,98,8],[24,100,8]].map(([x,y,r],i)=> <circle key={i} cx={x} cy={y} r={r} />)}
          </g>
          {/* hill */}
          <ellipse cx="292" cy="78" rx="66" ry="50" fill="#E1DAC2" />
          <ellipse cx="292" cy="76" rx="46" ry="34" fill="none" stroke="#CDBF9B" strokeWidth="1.2" />
          <ellipse cx="292" cy="74" rx="26" ry="18" fill="none" stroke="#CDBF9B" strokeWidth="1.2" />
          {/* meadow */}
          <rect x="88" y="160" width="106" height="70" rx="22" fill="#D7E3BF" />
          <g stroke="#B3C795" strokeWidth="1.4" strokeLinecap="round">
            {[[104,178],[124,172],[162,176],[178,190],[110,214],[170,216]].map(([x,y],i)=> <path key={i} d={`M${x} ${y}l-3 -6M${x+4} ${y}l1 -7M${x+8} ${y}l3 -6`} />)}
          </g>
          {/* lake */}
          <path d="M262 168c30-10 70 6 72 52s-4 98-34 104-60-16-62-58 0-90 24-98z" fill="#BCD5DB" stroke="#A3C2CB" strokeWidth="2" />
          {/* farm buildings */}
          <g fill="#D8C1A0" stroke="#C0A57F" strokeWidth="1">
            <rect x="52" y="296" width="34" height="24" rx="3" /><rect x="104" y="342" width="30" height="20" rx="3" /><rect x="46" y="382" width="30" height="18" rx="3" />
          </g>
          {/* sports field */}
          <rect x="208" y="346" width="92" height="50" rx="6" fill="#CBDDB3" />
          <g stroke="#F5F2E8" strokeWidth="1.5" fill="none"><rect x="214" y="352" width="80" height="38" rx="3" /><path d="M254 352v38" /><circle cx="254" cy="371" r="7" /></g>
          {/* paths */}
          <g fill="none" stroke="#F7F3E6" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M180 420C178 380 174 350 172 326S186 288 198 272 168 220 140 200 104 120 96 84" />
            <path d="M172 326C150 330 120 330 100 340S80 320 70 316" />
            <path d="M100 340C96 360 80 380 62 398" />
            <path d="M172 326C200 340 230 352 252 372S310 392 330 400" />
            <path d="M198 272C210 256 222 240 236 226" />
          </g>
          <path d="M140 200C190 170 240 130 292 72" fill="none" stroke="#F7F3E6" strokeWidth="3.5" strokeDasharray="2 6" strokeLinecap="round" />
          <path d="M236 226C248 290 280 330 316 318" fill="none" stroke="#F7F3E6" strokeWidth="3.5" strokeDasharray="2 6" strokeLinecap="round" />
          {/* entrance + compass */}
          <text x="186" y="412" fontSize="10.5" fill="#6B756C" fontWeight="600">{text.entrance}</text>
          <g transform="translate(332 30)" fill="#6B756C"><path d="M0 -12l5 12h-10z" /><text y="14" fontSize="9" textAnchor="middle" fontWeight="700">N</text></g>

          {pinned.map((p) => {
            const pt = MAP_POINTS[p.key];
            const on = p.key === sel;
            const lx = pt.label === 'right' ? pt.x + 13 : pt.label === 'left' ? pt.x - 13 : pt.x;
            const ly = pt.label === 'below' ? pt.y + 22 : pt.label === 'above' ? pt.y - 15 : pt.y + 4;
            const anchor = pt.label === 'left' ? 'end' : pt.label === 'right' ? 'start' : 'middle';
            return (
              <g key={p.key} className="mappin" onClick={() => setSel(p.key)} role="button" tabIndex={0} aria-label={p.label}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(p.key); } }}>
                {on ? <circle cx={pt.x} cy={pt.y} r="17" fill="#C9A227" opacity="0.28" /> : null}
                <circle cx={pt.x} cy={pt.y} r={on ? 10 : 7} fill={on ? '#B5852A' : '#3D6B4F'} stroke="#fff" strokeWidth="2.5" />
                <text x={lx} y={ly} textAnchor={anchor} fontSize={on ? 13 : 11.5} fontWeight={on ? 800 : 600} fill={on ? '#22302A' : '#3A463F'}
                  style={{ paintOrder: 'stroke', stroke: '#E8EADB', strokeWidth: 4, strokeLinejoin: 'round' }}>{p.label}</text>
              </g>
            );
          })}
        </svg>

        <ul className="maplist">
          {[...places].sort((a, b) => Number(b.key === current) - Number(a.key === current)).map((p) => (
            <li key={p.key}>
              <button type="button" aria-pressed={p.key === sel} onClick={() => setSel(p.key)}>
                <span className="dot" data-on={p.key === sel} />
                <span className="stack" style={{ gap: 2, minWidth: 0, textAlign: 'start' }}>
                  <span style={{ fontWeight: 700 }}>{p.label}{p.key === current ? <span className="you">{text.yourNext}</span> : null}</span>
                  <span className="muted" style={{ fontSize: 13 }}>{p.activities.join(zh ? '、' : ', ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </>
  );
}
