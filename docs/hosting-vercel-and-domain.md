# Hosting: Vercel plan analysis + linking ascnd.design

Researched 2026-07-26 against Vercel's live docs. Every limit below is quoted from
`vercel.com/docs` as of that date — Vercel changes these, so re-check before a big launch.

---

## 1. The headline: traffic is not what decides this

You asked about request limits. Those turn out to be the *second* problem. The first one is a
policy rule, and it's binding:

> **Hobby teams are restricted to non-commercial personal use only. All commercial usage of the
> platform requires either a Pro or Enterprise plan.**
>
> Commercial usage is defined as any Deployment that is used for the purpose of financial gain of
> **anyone** involved in **any part of the production** of the project… Examples include, but are not
> limited to:
> - Any method of requesting or processing payment from visitors of the site
> - **Advertising the sale of a product or service**
> - Receiving payment to create, update, or host the site
>
> — [Fair Use Guidelines § Commercial usage](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage)

ascnd is a paid design subscription. The site advertises the sale of that service, it has pricing,
and `CLAUDE.md` already plans Stripe checkout and Cal.com booking. That is three separate hits on
the "never fair use" list. It is not a grey area.

**Conclusion: ascnd.design has to be on Pro ($20/month) regardless of how little traffic it gets.**
Staying on Hobby is a terms violation, and Vercel's remedy is to disable the deployment — which
would take the site down at exactly the moment it's getting attention.

Everything below is still worth knowing, because it tells you *when* Pro's included allowances
would start costing you extra money.

---

## 2. The "10k edge requests" figure is wrong

There is no 10,000-request limit anywhere in Vercel's pricing. The number you're thinking of is
**10,000,000** — that's the Edge Requests *included with Pro*.

| Plan | Edge Requests included |
| --- | --- |
| Hobby | **up to 1,000,000 / month** |
| Pro | **10,000,000 / month**, then on-demand (regionally priced) |

— [Hobby plan comparison table](https://vercel.com/docs/plans/hobby#comparing-hobby-and-pro-plans)

Ironically your instinct wasn't far off in *effect*, just off by 100× in the number — see the
traffic math in §4, where this site works out to roughly 11k visits/month against the Hobby
request ceiling. Right ballpark, wrong mechanism.

### What counts as an Edge Request

> When visiting your site, requests are made to a Vercel CDN region… **Static assets and functions
> all incur CDN Requests.** CDN Requests appear as **Edge Requests** in your billing dashboard.
>
> — [CDN pricing and usage](https://vercel.com/docs/manage-cdn-usage#cdn-requests)

So it is **every HTTP request**, not every pageview: the HTML document, each JS chunk, each font,
each image, each `.glb`. One visit to this site is ~70–110 requests, not 1. That's the multiplier
people miss. A `304 Not Modified` revalidation still costs a request (Vercel's own optimization
guide tells you to hunt for 304s in devtools for exactly this reason).

---

## 3. Full Hobby ceilings, and what actually happens when you hit one

| Resource | Hobby included | Relevance to this site |
| --- | --- | --- |
| **Fast Data Transfer** (CDN → visitor) | **100 GB / mo** | The other binding limit. See §4. |
| **Edge Requests** | **1,000,000 / mo** | The first binding limit. See §4. |
| Fast Origin Transfer | up to 10 GB / mo | ~0 today (static site). Grows with Stripe/Cal routes. |
| Function Invocations | 1,000,000 / mo | ~0 today. Plenty of headroom later. |
| Active CPU | 4 CPU-hrs / mo | ~0 today. |
| Provisioned Memory | 360 GB-hrs / mo | ~0 today. |
| Image Transformations | 5,000 / mo | Low — most heavy images are `unoptimized`. See §5. |
| Image Cache Reads / Writes | 300K / 100K per mo | Low, same reason. |
| Deployments | 100 / day, 100 / hour | Fine. |
| Domains per project | 50 | Fine. |
| Build time | 45 min / deployment | Fine. |
| Runtime log retention | **1 hour** | Painful for debugging a live launch. Pro gives 1 day. |
| Build machine | 2 vCPU / 8 GB | Fine, but slower builds than Pro's 4 vCPU. |

Sources: [Limits](https://vercel.com/docs/limits) · [Hobby plan](https://vercel.com/docs/plans/hobby) · [Fair Use](https://vercel.com/docs/limits/fair-use-guidelines#typical-monthly-usage-guidelines)

### The failure mode is a 30-day outage, not a bill

This is the part that matters most for a launch:

> As the Hobby plan is a free tier there are no billing cycles. In most cases, **if you exceed your
> usage limits on the Hobby plan, you will have to wait until 30 days have passed before you can
> use the feature again.**
>
> — [Hobby billing cycle](https://vercel.com/docs/plans/hobby#hobby-billing-cycle)

There is no overage, no "just charge my card." You cannot pay your way out mid-month. If a Product
Hunt post or a viral Instagram Reel pushes you past 1M requests on day 12, the site is degraded or
down until day 30 — during the exact window the traffic was worth something.

Pro inverts this: you exceed the included allowance and Vercel bills on-demand, and you get
[Spend Management](https://vercel.com/docs/spend-management) to cap the damage — set a dollar
ceiling with an alert, or an auto-pause if you'd rather go down than get billed. **Set this up on
day one of Pro**; it's the safety net Hobby doesn't have.

### One more Hobby trap, specific to you two

> Vercel does not support connecting a project on your Hobby team to Git repositories owned by Git
> **organizations**.
>
> — [Limits § Connecting a project to a Git repository](https://vercel.com/docs/limits#connecting-a-project-to-a-git-repository)

Right now `origin` is `github.com/mohed-abbas/ascnd-design` — a personal repo, so this works. The
moment ascnd becomes a two-founder org repo so Hamail can push, Hobby stops being an option
mechanically, not just contractually.

---

## 4. Traffic math for *this* site

Measured from the repo on 2026-07-26:

- **Tracked assets in `public/`: 8.62 MB across 68 files.** This is a single-page site, so a
  full scroll-through pulls most of it.
- Self-hosted fonts: 148 KB (4 × Product Sans woff2), plus Instrument Serif + Geist Mono.
- JS: Next 16 runtime + React 19 + three.js + R3F + drei + GSAP + Lenis. Realistically 400–600 KB
  compressed — this is the one number I estimated rather than measured (see "how to measure it
  exactly" below).

**Working figure: ~5.5 MB and ~90 requests for one cold, full-scroll visit.**

| Limit | Hobby | Cold visits before you hit it |
| --- | --- | --- |
| Edge Requests | 1,000,000 | **~11,000 / month** ← binds first |
| Fast Data Transfer | 100 GB | ~18,500 / month |

| Limit | Pro | Cold visits before *paid* overage |
| --- | --- | --- |
| Edge Requests | 10,000,000 | ~110,000 / month |
| Fast Data Transfer | 1 TB | ~185,000 / month |

Two things soften these numbers in your favour, both already in the codebase:

1. **`next.config.ts` already sets aggressive caching** — `max-age=86400,
   stale-while-revalidate=31536000` on every image directory, and `immutable` on the versioned
   GLB. A repeat visitor within 24 hours costs you the HTML document and little else. That header
   block is doing real money-saving work; don't weaken it.
2. **The two biggest files in `public/rocks/` never ship.** The 11 MB `hf_2026…png` and the 8.4 MB
   `glb2.glb` are untracked, and Vercel deploys from git. ⚠️ If anyone ever runs a blanket
   `git add public/` or deploys with the `vercel` CLI from a local directory, ~22 MB of scratch
   assets start shipping to every visitor. Worth a `.gitignore` entry.

Working against you: **bots count.** Crawlers, uptime monitors, preview-link scrapers and AI
crawlers all generate Edge Requests, and they don't respect your cache headers the way a browser
does. Budget maybe 20–30% of your request volume for non-humans on a public marketing site.

### How to measure the per-visit payload exactly

I did not run a production build (the dev server is yours to run, and a concurrent `next build`
would fight it for `.next/`). When you next have the server stopped:

```bash
npm run build   # the route table prints First Load JS per route
```

Then, on the deployed site: DevTools → Network → disable cache → hard reload → scroll the whole
page → read the bottom bar for total requests and transferred bytes. That gives you the two real
numbers to plug into the table above.

---

## 5. Image Optimization is not your bottleneck (and that's a deliberate win)

A transformation is billed per **cache MISS/STALE**, keyed on source image + width + quality +
format — not per pageview. Repeat views of an already-transformed image cost nothing.

More importantly, most of the heavy art on this site is marked `unoptimized` on purpose — the
hero rocks, the design-shot tiles, the card mockups — because Next's optimizer was visibly
softening the hand-tuned cutouts (documented in `rock.tsx` and `design-shots.tsx`). Those bypass
the optimizer entirely and count as plain static files. So the 5,000-transformation Hobby cap is
nowhere near being a problem, and it stays a non-problem on Pro.

If you ever *do* blow the Hobby image cap, the failure is graceful-ish but ugly: new images return
HTTP 402 and render their `alt` text; already-cached ones keep working.
([Image Optimization limits](https://vercel.com/docs/image-optimization/limits-and-pricing#hobby))

---

## 6. Linking ascnd.design (Namecheap → Vercel)

Two routes. **Take route A.**

### Route A — keep Namecheap DNS, point records at Vercel (recommended)

Keeps your registrar as the source of truth for DNS, which means email (Google Workspace,
Fastmail, whatever you set up for `hello@ascnd.design`) stays independent of your host. Nothing
about your hosting choice can break your mail.

**Step 1 — add the domain in Vercel.**
Project → **Settings** → **Domains** → **Add Domain** → `ascnd.design`.
Vercel will prompt you to add `www.ascnd.design` too. Add both.

**Step 2 — read the values Vercel gives you. Do not copy them from a blog post.**
Vercel's docs are now explicit that the published values are generic and your project may differ:

> The DNS values shown above (`76.76.21.21` and `cname.vercel-dns-0.com`) are Vercel's
> general-purpose values. **Your project may have specific values.** Run
> `vercel domains inspect example.com` to see the exact records recommended for your domain.
>
> — [Setting up a custom domain](https://vercel.com/docs/domains/set-up-custom-domain)

Newer projects get a per-project CNAME that looks like `d1d4fc829fe7bc7c.vercel-dns-017.com`, and
the apex IP is drawn "from a pool of optimized Anycast IPs tailored to your plan and project."
The dashboard's Domains tab shows exactly what yours needs. Use that.

**Step 3 — Namecheap: Domain List → Manage → Advanced DNS.**

First, **delete Namecheap's default parking records.** Namecheap ships every new domain with a
`CNAME` on `www` → `parkingpage.namecheap.com` and a `URL Redirect Record` on `@`. Both will fight
your new records and cause intermittent, maddening "works on my phone but not my laptop" failures.
Remove them before adding anything.

Then add:

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| A Record | `@` | *(the IP from Vercel — generally `76.76.21.21`)* | Automatic |
| CNAME Record | `www` | *(the CNAME from Vercel — generally `cname.vercel-dns-0.com`)* | Automatic |

Note the trailing behaviour: Namecheap appends your domain to the Host field, so `@` means the
apex and `www` means `www.ascnd.design`. Don't type the full domain into Host.

**Step 4 — if the domain has any CAA records, allow Let's Encrypt.** Fresh Namecheap domains
usually have none, in which case skip this. If there are any, you must add:

```
0 issue "letsencrypt.org"
```

Without it, certificate issuance silently fails. ([Vercel KB](https://vercel.com/kb/guide/a-record-and-caa-with-vercel))

**Step 5 — wait, then verify.** Propagation is usually minutes, occasionally hours.

```bash
dig +short ascnd.design            # should return Vercel's anycast IP
dig +short www.ascnd.design        # should return the vercel-dns CNAME chain
```

Vercel auto-provisions the Let's Encrypt certificate once DNS verifies — "typically within a few
minutes." The Domains tab flips to a green "Valid Configuration."

**Step 6 — pick a canonical host.** Decide whether `ascnd.design` or `www.ascnd.design` is
primary, then set the other to redirect in Vercel's Domains settings. Vercel recommends `www` as
primary; for a short brandable domain like this one I'd go bare `ascnd.design` primary with `www`
→ apex 308 redirect. Either is fine, but **pick one and redirect the other** — serving both live
splits your SEO and looks sloppy in shares.

### Route B — delegate nameservers to Vercel

In Namecheap, set **Custom DNS** to `ns1.vercel-dns.com` / `ns2.vercel-dns.com`. Vercel then
manages everything and configuration is automatic.

Only take this if you need a **wildcard** domain (`*.ascnd.design`) — Vercel requires nameserver
delegation for wildcards. The cost is that every other DNS record you'll ever want (MX for email,
TXT for SPF/DKIM/DMARC, domain verification records for Stripe/Google/Instagram) has to be
recreated inside Vercel, and Vercel's warning is blunt: *"you will need to add any DNS records to
Vercel that you wish to keep from your previous DNS provider."* Forgetting your MX records here is
how people silently lose email for a day.

You don't need wildcards. Take route A.

---

## 7. Recommendation

1. **Upgrade to Pro before you point the domain.** $20/month. It's not a performance decision, it's
   a terms-of-service one — the site sells a service. Doing it before the DNS cutover means you
   never have a commercial site sitting on Hobby at a public address.
2. **Turn on Spend Management immediately** with a ceiling you're comfortable with (say $50) and an
   email alert. This is the thing Hobby structurally cannot give you: the ability to absorb a
   traffic spike instead of going dark for 30 days.
3. **Route A for DNS.** A record on `@`, CNAME on `www`, delete the Namecheap parking records
   first, use the exact values from your project's Domains tab.
4. **Add the untracked `public/rocks/` scratch files to `.gitignore`** so 22 MB of raw exports can
   never accidentally ship.
5. **Measure the real per-visit payload** with `npm run build` + a DevTools network trace, and
   replace my ~5.5 MB estimate in §4 with the true number.
6. Once Stripe and Cal.com land, revisit Function Invocations and Fast Origin Transfer — they're
   at zero today and will be the first *new* lines to appear on the usage dashboard.

At Pro's included allowances this site supports roughly **100k+ visits/month before you pay a cent
over the $20**. For a prelaunch design studio, that is not a constraint you will feel.

---

## 8. Stress test: 100,000 visits on day one, on Hobby

At ~90 requests / ~5.5 MB per cold visit:

| Milestone | Cumulative visits | Elapsed (even pace) |
| --- | --- | --- |
| **Edge Requests cap** (1,000,000) | ~11,100 | ~2.7 h |
| **Fast Data Transfer cap** (100 GB) | ~18,200 | ~4.4 h |
| Full day demand | 100,000 | **9M requests · 550 GB** |

You'd need 9× the request allowance and 5.5× the transfer allowance. Requests bind first, and
because viral traffic is front-loaded rather than even, the real trip point is likely inside the
first 60–90 minutes. **Roughly 89,000 of the 100,000 visitors arrive after the site is already
broken.**

Recovery is the documented 30-day wait — *or* upgrading to Pro mid-incident, which swaps in Pro's
limits and restores service. So you are not truly locked out for 30 days if you have a card on
file, but you'd be doing it under pressure with a chunk of the spike already bounced.

**The same day on Pro:** 9M requests against 10M included, 550 GB against 1 TB included — it fits,
at **no cost above the $20 seat**. It consumes ~90% of the month's request allowance, so a second
such day would run overage at roughly **$18 (requests) + $82 (transfer) ≈ $100/day** at US rates
($2.00/M requests, $0.15/GB; up to $3.20/M and $0.35/GB in the priciest regions).

Sustained 100k/day for a full month would be ~270M requests and ~16.5 TB → on the order of
**$2,800/month** in overage. That is the number Spend Management exists to cap.

Sensitivity: these all scale linearly with the per-visit payload. **Halving requests-per-visit
doubles every ceiling above** — at ~45 requests/visit you'd survive to ~22k visits even on Hobby.

---

## 9. Alternative: self-hosting on the Hostinger VPS

Specs on hand: **Hostinger KVM 2 — 2 vCPU, 8 GB RAM, 100 GB NVMe, 8 TB bandwidth**, paid through
**2027-02-06**, auto-renew on.

### 9.1 Can the Namecheap domain point at it? Yes — and it's simpler than Vercel

No per-project CNAMEs, no anycast pool, no verification dance. One IP.

In Namecheap → Domain List → Manage → **Advanced DNS** (delete the default parking `CNAME www` and
`URL Redirect @` records first, same as before):

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| A Record | `@` | *(your VPS IPv4)* | Automatic |
| A Record | `www` | *(same VPS IPv4)* | Automatic |
| AAAA Record | `@` | *(VPS IPv6, if assigned)* | Automatic |

Then on the box: nginx as reverse proxy + `certbot --nginx` for Let's Encrypt, which auto-renews
via a systemd timer. Redirect one host to the other in nginx so you serve a single canonical URL.

If you front it with Cloudflare (see 9.4), you instead switch Namecheap to Cloudflare's
nameservers and manage the A records inside Cloudflare with the proxy enabled.

### 9.2 Is the hardware enough? Comfortably — it's not close

| | Vercel Pro | Hostinger KVM 2 |
| --- | --- | --- |
| Monthly transfer | 1 TB included | **8 TB** |
| Visits at ~5.5 MB | ~185,000 | **~1,450,000** |
| Request metering | 10M then billed | **none** |

**That 100k-visit day that kills Hobby is a non-event here.** 550 GB is 7% of the monthly
allowance. Load-wise, 9M requests spread over 24h is ~104 req/s average; even a 10× peak is ~1,000
req/s, and nginx serving cached static files on 2 cores does that without noticing. Your ceiling is
network egress, not CPU — ~51 Mbps average on a port that's typically 1 Gbps.

The one place the 8 TB does bite: *sustained* 100k/day is 16.5 TB/month, so you'd exhaust the cap
around day 15. Cloudflare in front removes that concern entirely.

Also relevant: **this app is fully static today.** No server actions, no dynamic APIs, and the only
route handler (`app/api/lab/sprites/route.ts`) is lab-only. `next build` prerenders the marketing
page to HTML. There is genuinely nothing hard about serving it.

### 9.3 What you actually give up

This is the honest cost, and it isn't CPU:

1. **Global edge → one datacenter.** The big one for *this* site. You ship ~5.5 MB of WebGL and
   image assets; from a single box, a visitor on the far side of an ocean pays full RTT on every
   one of ~90 requests. Vercel serves them from a nearby edge. Pick the datacenter nearest your
   ICP (funded early-stage SaaS founders skew US), and read 9.4 — this is the gap Cloudflare closes.
2. **Per-branch preview deployments, gone.** You've been iterating on `lab/portfolio-V2`,
   `enhancement/restructure-canvas` and friends. Losing a shareable URL per branch is a real
   workflow regression, especially with two founders reviewing each other's work.
3. **DDoS protection, gone.** Vercel has it on by default; a bare VPS is exposed. Cloudflare fixes.
4. **Instant rollback, gone.** Vercel reverts to any prior deployment in one click. You'd need a
   releases-directory + symlink scheme to match that.
5. **Zero-downtime deploys** need building: `pm2 reload`, or two slots with an nginx switch.
6. **You own uptime.** Patching, `ufw`, `fail2ban`, key-only SSH, unattended-upgrades, monitoring,
   backups, and the 3am page when the box OOMs. Vercel is someone else's job.

### 9.4 Cloudflare (free) in front is what makes this genuinely competitive

Point the domain at Cloudflare, origin at the VPS, proxy on. You get a global CDN caching your
static assets near every visitor, free TLS, DDoS mitigation, and most of your 8 TB never leaves the
box because Cloudflare serves the repeat hits. Free tier, no bandwidth metering for this kind of
content. **VPS + Cloudflare closes ~80% of the gap with Vercel for a static marketing site.**

### 9.5 Codebase-specific gotchas — read before you cut over

- ⚠️ **Your `next.config.ts` `headers()` block only applies to requests Next.js serves.** If you
  configure nginx to serve `/public` directly off disk (the obvious "make it fast" move), the
  `stale-while-revalidate` and `immutable` headers you deliberately engineered vanish, and you're
  back to a 304 revalidation round-trip per file on every visit — the exact failure mode those
  headers were written to kill. Either proxy everything through `next start`, or replicate the
  header rules in your nginx config. Load-bearing.
- ⚠️ **The untracked 22 MB in `public/rocks/` becomes a live risk.** On Vercel it can't ship
  (git-based deploys). With an `rsync`-from-local deploy it absolutely will. Add it to
  `.gitignore` *and* use `--exclude` / deploy from a clean checkout.
- **`sharp` on glibc Linux** may need memory-allocator tuning or image optimization can balloon
  RAM — called out explicitly in Next 16's self-hosting guide. You use the optimizer for some
  tiles, so this applies.
- **Don't build on the VPS while it serves traffic.** A three.js/R3F `next build` on 2 vCPU is
  slow and will contend with request serving. Build in GitHub Actions, ship the artifact.
- **Set `output: 'standalone'`** in `next.config.ts` to shrink what you copy to the box.
- **`/lab/*` routes and the sprites API are publicly reachable** on any host. Worth gating or
  excluding before launch either way — this is not a VPS-specific issue, but self-hosting is a
  natural moment to fix it.

### 9.6 The money, honestly

The VPS is prepaid to **2027-02-06**, so its marginal cost right now is **$0** versus $20/month for
Vercel Pro — about **$240/year saved**.

But watch the renewal cliff: Hostinger's KVM 2 promo pricing (~$7–10/month on long terms) renews at
a substantially higher rate — reviews report increases in the 140–232% range across plans. Budget
something like **$18–23/month at renewal**, at which point the VPS costs roughly what Vercel Pro
costs and the savings argument evaporates. The decision point is February 2027, not today.

### 9.7 Verdict

Technically, self-hosting this site is **not a hard problem** — it's a static Next.js build, your
VPS is oversized for it, and 8 TB + Cloudflare beats Vercel Pro's included transfer by a wide
margin. With 7+ years of dev experience this is well within reach.

The problem is **timing**. ascnd launches at the end of July 2026 — days away. Standing up nginx,
TLS, a deploy pipeline, process supervision, monitoring and Cloudflare, then discovering the
`headers()` regression in 9.5 under launch traffic, is the wrong week for that. New infrastructure
fails in ways you only find in production.

**Recommendation:**

1. **Launch on Vercel Pro.** $20 for the launch month buys zero new failure modes at the moment
   you can least afford them, and it resolves the commercial-use violation immediately.
2. **Build the VPS setup in parallel, unhurried**, behind Cloudflare, on a staging subdomain
   (`staging.ascnd.design`). Prove it under real conditions.
3. **Cut over when it's boring**, and decide for real before the February 2027 renewal — by then
   you'll know your actual traffic shape and whether the $240/year is worth owning uptime.

The VPS is a good answer to the *wrong week*. Keep it; just don't make it a launch dependency.
