import { useMemo, useState } from 'react';
import {
  Activity,
  BriefcaseBusiness,
  Building2,
  Crosshair,
  Flame,
  Hotel,
  Map,
  MapPin,
  Navigation,
  Users,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import PageShell from '@/components/admin/PageShell';
import {
  clientHeatMapNeighborhoods,
  clientHeatMapSources,
  heatMapLenses,
  premiumFitnessAnchors,
  rankNeighborhoods,
  scoreNeighborhood,
} from '@/data/clientHeatMap';

const HEAT_COLORS = {
  rose: 'bg-rose-400',
  amber: 'bg-amber-300',
  orange: 'bg-orange-400',
  emerald: 'bg-emerald-300',
  cyan: 'bg-cyan-300',
  violet: 'bg-violet-300',
  lime: 'bg-lime-300',
  pink: 'bg-pink-300',
  blue: 'bg-blue-300',
  slate: 'bg-slate-300',
};

const LENS_ICONS = {
  overall: Map,
  members: Users,
  corporate: BriefcaseBusiness,
  hotels: Hotel,
  events: Activity,
};

function fitTone(score) {
  if (score >= 88) return 'text-emerald-200 border-emerald-300/25 bg-emerald-300/[0.07]';
  if (score >= 80) return 'text-amber-100 border-amber-300/25 bg-amber-300/[0.07]';
  return 'text-foreground/62 border-foreground/10 bg-foreground/[0.04]';
}

function Stat({ label, value, detail, icon: Icon }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.035] p-4">
      <div className="mb-5 flex items-start justify-between gap-3">
        <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/40">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-foreground/38" strokeWidth={1.6} />
      </div>
      <p className="font-heading text-4xl uppercase leading-none tracking-tight text-foreground">{value}</p>
      <p className="mt-1 font-body text-[11px] leading-snug text-foreground/46">{detail}</p>
    </div>
  );
}

function LensButton({ lens, active, onClick }) {
  const Icon = LENS_ICONS[lens.id] || Map;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-3.5 font-body text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
        active
          ? 'border-accent/45 bg-accent/12 text-accent'
          : 'border-foreground/10 bg-foreground/[0.035] text-foreground/54 hover:text-foreground'
      }`}
      aria-pressed={active}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      {lens.label}
    </button>
  );
}

function HeatTile({ neighborhood, score, selected, onSelect }) {
  const heat = Math.max(0.16, score / 100);
  const colorClass = HEAT_COLORS[neighborhood.color] || 'bg-accent';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group absolute overflow-hidden rounded-xl border text-left shadow-[0_22px_70px_hsl(var(--foreground)/0.08)] transition-all duration-300 ${
        selected
          ? 'z-20 scale-[1.035] border-background ring-2 ring-accent/80'
          : 'border-background/30 hover:z-10 hover:scale-[1.02] hover:border-background/60'
      }`}
      style={{
        left: `${neighborhood.x}%`,
        top: `${neighborhood.y}%`,
        width: `${neighborhood.w}%`,
        height: `${neighborhood.h}%`,
        opacity: heat,
      }}
      aria-label={`${neighborhood.name} ideal client fit ${score}`}
    >
      <span className={`absolute inset-0 ${colorClass}`} />
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.42),transparent_48%)]" />
      <span className="relative flex h-full min-h-[72px] flex-col justify-between p-2.5 text-background">
        <span className="font-body text-[9px] font-black uppercase leading-tight tracking-[0.1em]">{neighborhood.name}</span>
        <span className="font-heading text-3xl uppercase leading-none">{score}</span>
      </span>
    </button>
  );
}

function AttributeBar({ label, value }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="font-body text-[9px] font-semibold uppercase tracking-[0.18em] text-foreground/42">{label}</p>
        <p className="font-body text-[10px] font-semibold text-foreground/58">{value}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-foreground/[0.06]">
        <div className="h-full rounded-full bg-accent/80" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RankingRow({ neighborhood, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        selected ? 'border-accent/45 bg-accent/10' : 'border-foreground/10 bg-foreground/[0.03] hover:bg-foreground/[0.055]'
      }`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border font-heading text-2xl leading-none ${fitTone(neighborhood.score)}`}>
        {neighborhood.score}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-[12px] font-semibold text-foreground">{neighborhood.name}</span>
        <span className="mt-1 block truncate font-body text-[10px] uppercase tracking-[0.12em] text-foreground/36">{neighborhood.primary}</span>
      </span>
      <Navigation className="h-4 w-4 shrink-0 text-foreground/34" strokeWidth={1.6} />
    </button>
  );
}

export default function ClientHeatMap() {
  const [lens, setLens] = useState('overall');
  const ranked = useMemo(() => rankNeighborhoods(lens), [lens]);
  const [selectedId, setSelectedId] = useState(ranked[0]?.id || clientHeatMapNeighborhoods[0].id);

  const selected = ranked.find((neighborhood) => neighborhood.id === selectedId) || ranked[0];
  const topThree = ranked.slice(0, 3);
  const avgScore = Math.round(ranked.reduce((sum, neighborhood) => sum + neighborhood.score, 0) / ranked.length);
  const selectedAnchors = premiumFitnessAnchors.filter((anchor) => anchor.neighborhoodId === selected.id);

  return (
    <AdminLayout>
      <PageShell
        eyebrow="Growth intelligence"
        title="Client Heat Map"
        subtitle="San Francisco Wellness Spend x Income index for Avalon ideal-client acquisition."
        action={
          <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.035] px-3 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/52">
            <Crosshair className="h-3.5 w-3.5 text-accent" strokeWidth={1.8} />
            SF model
          </div>
        }
      >
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <section className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <Stat icon={Flame} label="Top spend x income" value={topThree[0]?.score || 0} detail={topThree[0]?.name || 'No data'} />
              <Stat icon={MapPin} label="Premium fitness anchors" value={premiumFitnessAnchors.length} detail="Equinox, Barry's, and similar clusters" />
              <Stat icon={Building2} label="Index average" value={avgScore} detail="Across modeled SF neighborhoods" />
            </div>

            <div className="rounded-[1.5rem] border border-foreground/10 bg-background/58 p-4 shadow-[0_24px_90px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-body text-[9px] font-semibold uppercase tracking-[0.24em] text-foreground/36">Lens</p>
                  <h2 className="mt-1 font-heading text-4xl uppercase leading-none tracking-tight text-foreground">Wellness Spend x Income</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {heatMapLenses.map((item) => (
                    <LensButton key={item.id} lens={item} active={lens === item.id} onClick={() => setLens(item.id)} />
                  ))}
                </div>
              </div>

              <div className="relative min-h-[520px] overflow-hidden rounded-[1.25rem] border border-foreground/10 bg-[linear-gradient(135deg,hsl(var(--foreground)/0.055),hsl(var(--background))_58%),radial-gradient(circle_at_68%_42%,hsl(var(--accent)/0.14),transparent_34%)] p-4">
                <div className="absolute inset-x-[8%] top-[16%] h-px bg-foreground/10" />
                <div className="absolute bottom-[18%] left-[10%] right-[12%] h-px bg-foreground/10" />
                <div className="absolute bottom-[12%] left-[55%] top-[14%] w-px bg-foreground/10" />
                <div className="absolute right-[15%] top-[22%] h-[56%] w-[12%] rounded-full border border-cyan-200/20 bg-cyan-200/[0.035]" />
                <div className="absolute left-[6%] top-[9%] rounded-full border border-foreground/10 px-3 py-1 font-body text-[9px] uppercase tracking-[0.18em] text-foreground/40">Golden Gate</div>
                <div className="absolute bottom-[7%] right-[8%] rounded-full border border-foreground/10 px-3 py-1 font-body text-[9px] uppercase tracking-[0.18em] text-foreground/40">Bay edge</div>

                {clientHeatMapNeighborhoods.map((neighborhood) => (
                  <HeatTile
                    key={neighborhood.id}
                    neighborhood={neighborhood}
                    score={scoreNeighborhood(neighborhood, lens)}
                    selected={neighborhood.id === selected.id}
                    onSelect={() => setSelectedId(neighborhood.id)}
                  />
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-[1.5rem] border border-foreground/10 bg-background/68 p-5 shadow-[0_24px_90px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/36">{selected.area}</p>
                  <h2 className="mt-1 font-heading text-4xl uppercase leading-none tracking-tight text-foreground">{selected.name}</h2>
                </div>
                <span className={`rounded-xl border px-3 py-2 font-heading text-3xl leading-none ${fitTone(selected.score)}`}>{selected.score}</span>
              </div>

              <div className="mb-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-accent/25 bg-accent/10 px-3 py-1.5 font-body text-[9px] font-semibold uppercase tracking-[0.14em] text-accent">{selected.primary}</span>
                <span className="rounded-full border border-foreground/10 bg-foreground/[0.035] px-3 py-1.5 font-body text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/54">{selected.secondary}</span>
              </div>

              <p className="font-body text-sm leading-relaxed text-foreground/68">{selected.signal}</p>
              <div className="mt-4 rounded-xl border border-foreground/10 bg-foreground/[0.035] p-4">
                <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/38">Next move</p>
                <p className="mt-2 font-body text-[12px] leading-relaxed text-foreground/64">{selected.action}</p>
              </div>
              <p className="mt-3 font-body text-[11px] leading-relaxed text-foreground/42">{selected.note}</p>

              <div className="mt-5 space-y-3">
                <AttributeBar label="Affluence" value={selected.affluence} />
                <AttributeBar label="Wellness spend" value={selected.wellnessSpend} />
                <AttributeBar label="Luxury fitness proximity" value={selected.luxuryFitness} />
                <AttributeBar label="Neighborhood exclusivity" value={selected.exclusivity} />
                <AttributeBar label="Spend x income" value={selected.spendIncome} />
                <AttributeBar label="Density" value={selected.density} />
                <AttributeBar label="Concierge fit" value={selected.concierge} />
                <AttributeBar label="Travel / event pull" value={selected.travel} />
                <AttributeBar label="Delivery efficiency" value={selected.delivery} />
              </div>
            </div>

            {selectedAnchors.length > 0 && (
              <div className="rounded-[1.25rem] border border-foreground/10 bg-background/68 p-4 shadow-[0_18px_70px_hsl(var(--foreground)/0.06)] backdrop-blur-2xl">
                <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/36">Nearby premium fitness</p>
                <div className="mt-3 space-y-2">
                  {selectedAnchors.map((anchor) => (
                    <div key={anchor.name} className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3">
                      <p className="font-body text-[11px] font-semibold text-foreground">{anchor.name}</p>
                      <p className="mt-1 font-body text-[10px] uppercase tracking-[0.12em] text-foreground/38">{anchor.address}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[1.5rem] border border-foreground/10 bg-background/68 p-5 shadow-[0_24px_90px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl">
              <p className="mb-3 font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/36">Ranked pockets</p>
              <div className="space-y-2">
                {ranked.map((neighborhood) => (
                  <RankingRow
                    key={neighborhood.id}
                    neighborhood={neighborhood}
                    selected={neighborhood.id === selected.id}
                    onSelect={() => setSelectedId(neighborhood.id)}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-foreground/10 bg-foreground/[0.03] p-4">
              <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/36">Model inputs</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {clientHeatMapSources.map((source) => (
                  <span key={source} className="rounded-full border border-foreground/10 bg-background/44 px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.12em] text-foreground/45">
                    {source}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </PageShell>
    </AdminLayout>
  );
}
