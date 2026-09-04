import { ArrowRight, CalendarDays, CirclePlus, Droplet, Shield, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import AvalonMark from '@/components/AvalonMark';
import ConsumerFooter from '@/components/landing/ConsumerFooter';
import { useSeo } from '@/lib/seo';

const money = (cents) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(Number(cents || 0) / 100);

const TIERS = ['Starter', 'Pro', 'VIP', 'Expert'];

const founderPlans = (family, unitPrice, orderOffset = 0) => TIERS.map((name, index) => ({
  family,
  name,
  creditsPerCycle: index + 1,
  monthlyPriceCents: (index + 1) * unitPrice * 100,
  versionId: `founder-${family}-${name.toLowerCase()}-${orderOffset + index + 1}`,
}));

const VITAMIN_PLANS = founderPlans('vitamin', 195);
const NAD_PLANS = founderPlans('nad', 300, 4);

function FounderPlanCard({ plan }) {
  return (
    <article className="flex min-w-0 flex-col rounded-[11px] border border-[#d8bca5] px-2.5 pb-3.5 pt-4 sm:px-3 min-[901px]:rounded-[14px] min-[901px]:px-6 min-[901px]:pb-6 min-[901px]:pt-7">
      <h3 className="text-center font-heading text-[24px] uppercase leading-none tracking-[0.01em] text-[#21170f] min-[901px]:text-[34px]">
        {plan.name}
      </h3>
      <p className="mx-auto mt-3 whitespace-nowrap rounded-md border border-[#b78f72] px-1.5 py-1.5 text-center font-body text-[8px] font-medium uppercase tracking-[-0.01em] text-[#21170f] sm:text-[9px] min-[901px]:mt-4 min-[901px]:px-3 min-[901px]:py-2 min-[901px]:text-[11px] min-[901px]:tracking-[0.03em]">
        {plan.creditsPerCycle} {plan.creditsPerCycle === 1 ? 'credit' : 'credits'} / month
      </p>
      <p className="mt-5 whitespace-nowrap font-body text-[30px] font-light leading-none tracking-[-0.055em] text-[#21170f] sm:text-[35px] min-[901px]:mt-8 min-[901px]:text-[48px]">
        {money(plan.monthlyPriceCents)}<span className="ml-0.5 text-[10px] font-normal tracking-normal min-[901px]:text-[13px]">/mo</span>
      </p>
      <Link
        to="/start"
        aria-label={`Join ${plan.name} membership — start your visit`}
        className="founder-plan-button mt-7 flex h-[38px] min-h-0 w-full items-center justify-between rounded-[3px] bg-[#241205] px-3 font-body text-[10px] font-medium text-[#fffaf5] shadow-[0_2px_3px_rgba(36,18,5,0.25)] transition-colors hover:bg-[#3a2010] focus:outline-none focus:ring-2 focus:ring-[#8d6549] focus:ring-offset-2 min-[901px]:mt-9 min-[901px]:px-5 min-[901px]:text-[12px]"
      >
        <span>Join {plan.name}</span><ArrowRight className="h-4 w-4" strokeWidth={1.5} />
      </Link>
    </article>
  );
}

function FounderPlanGroup({ id, title, subtitle, note, plans, aside, compact = false }) {
  return (
    <section id={id} className={compact ? 'mt-6 min-[901px]:mt-14' : 'mt-11 sm:mt-12 min-[901px]:mt-16'}>
      <div className="flex items-end justify-between gap-4 px-1.5">
        <div>
          <h2 className="font-heading text-[28px] uppercase leading-none tracking-[0.01em] text-[#21170f] min-[901px]:text-[40px]">{title}</h2>
          <p className="mt-2 font-body text-[11px] text-[#37291f] min-[901px]:mt-3 min-[901px]:text-[13px]">{subtitle}</p>
        </div>
        {aside && <p className="pb-0.5 font-body text-[8px] text-[#5a4637] min-[901px]:text-[11px]">{aside}</p>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5 min-[560px]:grid-cols-4 min-[901px]:mt-6 min-[901px]:gap-4">
        {plans.map((plan) => <FounderPlanCard key={plan.versionId} plan={plan} />)}
      </div>
      {note && <p className="mt-4 px-1.5 font-body text-[9px] leading-relaxed text-[#37291f] sm:text-[10px] min-[901px]:mt-5 min-[901px]:text-[12px]">{note}</p>}
    </section>
  );
}

function MembershipStep({ number, title, children, last = false }) {
  return (
    <article className="relative grid min-h-[126px] grid-cols-[58px_1fr] items-center gap-4 rounded-[11px] border border-[#d8bca5] px-5 py-5 min-[901px]:min-h-[96px] min-[901px]:grid-cols-[56px_1fr] min-[901px]:gap-4 min-[901px]:rounded-[14px] min-[901px]:px-5 min-[901px]:py-3">
      <p className="font-heading text-[50px] leading-none text-[#21170f] min-[901px]:text-[50px]">{number}</p>
      <div>
        <h3 className="font-body text-[10px] font-semibold uppercase tracking-[0.11em] text-[#21170f] min-[901px]:text-[10px]">{title}</h3>
        <p className="mt-2 font-body text-[10px] leading-relaxed text-[#4b392c] min-[901px]:mt-1.5 min-[901px]:text-[10px]">{children}</p>
      </div>
      {!last && <ArrowRight className="absolute -right-[2.1rem] top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-[#aa8062] min-[901px]:block" strokeWidth={1.3} />}
    </article>
  );
}

function EssentialItem({ icon: Icon, title, children, className = '' }) {
  return (
    <div className={`flex items-start gap-4 px-1 py-4 min-[901px]:gap-3 min-[901px]:px-3 min-[901px]:py-2 ${className}`}>
      <Icon className="mt-0.5 h-7 w-7 shrink-0 text-[#21170f] min-[901px]:h-6 min-[901px]:w-6" strokeWidth={1.35} />
      <div>
        <h3 className="font-body text-[10px] font-semibold uppercase tracking-[0.1em] min-[901px]:text-[10px]">{title}</h3>
        <p className="mt-1.5 font-body text-[10px] leading-relaxed text-[#5a4637] min-[901px]:mt-1 min-[901px]:text-[10px]">{children}</p>
      </div>
    </div>
  );
}

export default function MembershipPricing() {
  useSeo({ title: 'Founder Memberships — Avalon Vitality', description: 'Founder membership pricing for Vitamin IV and NAD+ IV care.', path: '/membership' });

  return (
    <>
    <main className="founder-memberships-page min-h-screen bg-[#fffaf6] text-[#21170f]">
      <div className="mx-auto w-full max-w-[646px] px-6 pb-5 pt-2 min-[901px]:max-w-none min-[901px]:px-[clamp(3.5rem,5.5vw,7rem)] min-[901px]:pb-12 min-[901px]:pt-0">
        <header className="flex items-center justify-between border-b border-[#d7b99f] pb-2 min-[901px]:hidden">
          <Link to="/" aria-label="Avalon Vitality home" className="flex items-center gap-2.5 text-[#21170f]">
            <AvalonMark className="h-[30px] w-[20px]" />
            <span className="font-heading text-[25px] uppercase tracking-[0.075em]">Avalon Vitality</span>
          </Link>
          <a href="mailto:support@avalonvitality.co" className="flex items-center gap-3 border-b border-[#21170f] pb-0.5 font-body text-[9px] text-[#21170f]">
            Talk to our team <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </a>
        </header>

        <section className="pt-8 text-center sm:pt-9 min-[901px]:pt-16">
          <p className="mx-auto font-body text-[12px] uppercase tracking-[0.18em] min-[901px]:text-[14px] min-[901px]:tracking-[0.22em]">Founder Memberships</p>
          <h1 className="mt-2 font-heading text-[50px] uppercase leading-[0.95] tracking-[0.005em] sm:text-[60px] min-[901px]:mt-3 min-[901px]:text-[clamp(76px,6vw,108px)]">Care that keeps up.</h1>
          <p className="mx-auto mt-3 font-body text-[14px] text-[#37291f] min-[901px]:mt-5 min-[901px]:text-[18px]">Monthly credits. Redeem for eligible IV visits.</p>
          <p className="mx-auto mt-4 font-body text-[10px] text-[#37291f] min-[901px]:mt-5 min-[901px]:text-[12px]">30-day enrollment <span className="px-2.5 min-[901px]:px-4">•</span> Billed monthly <span className="px-2.5 min-[901px]:px-4">•</span> 3-month minimum</p>
        </section>

        <FounderPlanGroup
          id="membership-options"
          title="Vitamin IV Memberships"
          subtitle="1 credit = 1 eligible vitamin IV visit"
          plans={VITAMIN_PLANS}
          note="Starter, Pro & VIP: 10% off add-ons. Pro: +1 IM shot/month. VIP: +2 IM shots/month."
        />

        <FounderPlanGroup
          title="NAD+ IV Memberships"
          subtitle="1 credit = 1 NAD+ IV visit  ·  250 mg per IV"
          aside="$50 founder savings per credit"
          plans={NAD_PLANS}
          compact
        />

            <section className="mt-10 min-[901px]:mx-auto min-[901px]:mt-20 min-[901px]:w-[78vw] min-[901px]:max-w-[1600px]">
              <p className="text-center font-body text-[10px] font-medium uppercase tracking-[0.18em] text-[#5a4637] min-[901px]:text-[13px]">The credit system</p>
              <h2 className="mt-2 text-center font-heading text-[34px] uppercase leading-none min-[901px]:mt-2 min-[901px]:text-[40px]">How your membership works</h2>
              <div className="mt-6 grid gap-4 min-[901px]:mt-5 min-[901px]:grid-cols-3 min-[901px]:gap-16">
                <MembershipStep number="01" title="Choose your credits">Select Vitamin IV or NAD+ and 1–4 credits per month.</MembershipStep>
                <MembershipStep number="02" title="Credits arrive monthly">Your plan adds credits each billing cycle.</MembershipStep>
                <MembershipStep number="03" title="Book with a credit" last>Redeem 1 credit for 1 eligible IV visit.</MembershipStep>
              </div>
            </section>

            <section className="mt-6 grid gap-4 min-[901px]:mx-auto min-[901px]:mt-6 min-[901px]:w-[78vw] min-[901px]:max-w-[1600px] min-[901px]:grid-cols-[1.45fr_1fr] min-[901px]:gap-5">
              <div className="rounded-[11px] border border-[#d8bca5] px-5 pb-3 pt-6 min-[901px]:rounded-[14px] min-[901px]:px-5 min-[901px]:pb-3 min-[901px]:pt-4">
                <h2 className="text-center font-body text-[11px] font-semibold uppercase tracking-[0.18em] min-[901px]:text-[11px]">Member essentials</h2>
                <div className="mt-3 grid divide-y divide-[#dcc9b8] min-[901px]:mt-3 min-[901px]:grid-cols-2 min-[901px]:divide-x min-[901px]:divide-y-0">
                  <EssentialItem icon={CalendarDays} title="Monthly billing">Credits are added each billing cycle.</EssentialItem>
                  <EssentialItem icon={Shield} title="Initial term">Three-month minimum.</EssentialItem>
                </div>
                <div className="grid divide-y divide-[#dcc9b8] border-t border-[#dcc9b8] min-[901px]:grid-cols-2 min-[901px]:divide-x min-[901px]:divide-y-0">
                  <EssentialItem icon={Droplet} title="Vitamin IV credit">Covers 1 eligible vitamin IV. Hydration excluded.</EssentialItem>
                  <EssentialItem icon={CirclePlus} title="NAD+ IV credit">Covers 1 listed 250 mg NAD+ IV.</EssentialItem>
                </div>
                <div className="grid items-center divide-y divide-[#dcc9b8] border-t border-[#dcc9b8] min-[901px]:grid-cols-[1.2fr_1fr] min-[901px]:divide-x min-[901px]:divide-y-0">
                  <EssentialItem icon={UserRound} title="Member portal">Manage credits, booking and billing.</EssentialItem>
                  <Link to="/terms-of-service" className="flex min-h-[64px] items-center justify-between gap-4 px-1 font-body text-[10px] text-[#4b392c] min-[901px]:min-h-[56px] min-[901px]:px-5 min-[901px]:text-[10px]">
                    View full membership terms <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={1.4} />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center rounded-[11px] border border-[#d8bca5] bg-[#f1e9e1] px-7 py-9 text-center min-[901px]:rounded-[14px] min-[901px]:px-8 min-[901px]:py-3">
                <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-[#5a4637] min-[901px]:text-[10px]">Ready when you are</p>
                <h2 className="mt-3 max-w-[420px] font-heading text-[42px] uppercase leading-[0.94] min-[901px]:mt-1 min-[901px]:text-[34px]">Choose your<br />monthly care.</h2>
                <p className="mt-4 max-w-[350px] font-body text-[11px] leading-relaxed text-[#5a4637] min-[901px]:mt-2 min-[901px]:text-[10px]">Pick your IV category and the number of credits that fits your routine.</p>
                <Link to="/start" className="mt-6 flex min-h-[48px] w-full max-w-[380px] items-center justify-center gap-3 rounded-[7px] bg-[#24170f] px-5 font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-[#fffaf5] transition-colors hover:bg-[#3a2417] min-[901px]:mt-2 min-[901px]:text-[10px]">
                  Choose your membership <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                </Link>
                <a href="mailto:support@avalonvitality.co" className="mt-3 flex min-h-[44px] items-center gap-3 border-b border-[#5a4637] px-1 font-body text-[10px] text-[#5a4637] min-[901px]:mt-0 min-[901px]:text-[10px]">
                  Talk to our care team <ArrowRight className="h-4 w-4" strokeWidth={1.4} />
                </a>
                <p className="mt-2 flex items-center justify-center gap-2 font-body text-[9px] text-[#5a4637] min-[901px]:mt-1 min-[901px]:text-[10px]">
                  <ShieldCheck className="h-4 w-4" strokeWidth={1.4} /> All visits are subject to clinical review.
                </p>
              </div>
            </section>
      </div>
    </main>
    <ConsumerFooter />
    </>
  );
}
