# SCRAPHEART · P0

A post-collapse field of stopped machines, and one you assemble from their parts.

**Play it:** open `SCRAPHEART.html`. One file, 50 kB, no install.

---

## the one question this build exists to answer

> **Ten players. One hour. Single-player.**
> **Seven name the companion unprompted, and react when it is badly hurt.**
> ⚠ **If it fails, stop the project.**

Everything in here was built to make that question answerable, and nothing was built
that does not serve it. The full brief is `IND-34-BRIEF-scrapheart.md`; the build log,
every measurement and every mistake is `NEXT.md`.

🚨 **Do not tell a tester they can name it.** The name field is deliberately unlabelled.
The moment you mention it, that player no longer counts toward the seven.

---

## what it is

You are a person in a field of several thousand machines that stopped mid-journey. You
find a chassis. You put things into it that you took out of the dead, and it stands up.

- **It is never commanded.** It scores every behaviour it can hold in mind and acts on
  the best one. What it does when you are not looking is who it is.
- **RAM is real.** A small mind holds two ideas. Frighten it and it drops one, and the
  one it drops is usually the part that was noticing beautiful things.
- **You die permanently.** Character gone, gear gone, everything you banked gone.
  **And the companion does not die.** It was standing next to you. It watched. It stays
  where you fell, and going back for it is a real trip because you are new and weak.
- **It does not simply resume.** Every fragment survives. The relationship does not,
  entirely, and you earn the rest back.
- **It can put itself between you and the thing about to kill you** ... if it can, if its
  weights favour you, and if you repaired it when it was damaged rather than only when
  it was convenient. It costs the fragment that let it. The socket stays empty.

The game never explains any of this and there is no morality anywhere.

## controls

| | |
|---|---|
| `WASD` | move |
| `click` / hold | fire (heat, not ammo ... ~2s of held fire locks it for 2s) |
| `Q` | **leave.** instant, always available, never on cooldown |
| `E` | hold near a damaged companion to repair it |
| `I` | pack + sockets |
| `M` | mute |

On a phone: **left thumb is a floating stick, right side fires.**

⚠ `Q` and `E` carry two of the three systems the gate tests. If a watcher has to explain
them, that is itself a finding.

---

## running it

```bash
npm install
npm run dev      # vite dev server
npm run check    # tsc --noEmit
npm run build    # dist/
npm run pack     # SCRAPHEART.html ... the single file, re-run after ANY src change
```

## the probes

Eleven headless playwright probes live in the session scratchpad and measure the claims
rather than the code shape: the recall, permadeath, the first loss, interposition, heat,
dust, the degrees, the difficulty curve, perf and touch, naming, and the single file.

🚨 **Every probe refuses to run if `src` is newer than `dist`.** That gate exists because
a threshold was changed from 1.05 to 1.30 without a rebuild and four rounds of perfectly
correct measurements were taken of the previous bundle.

**Two rules learned the hard way here:**
1. **A red probe is a claim about which of the two is stale, and it is not always the
   code.** Four probes in this build encoded a contract the design had moved past.
2. **Test the claim, not the journey to it.** A bot dying to a warden proves the bot
   cannot dodge, and nothing about whether a warden one-shots a handler.

---

## design canon

`IND-34` and `IND-34a` … `IND-34n` in `blueprints/independent/`. The code defers to them;
where the code and a doc disagree, the doc is right and the code is a bug.

`IND-34n` is the odd one out: it is the shipped-game calibration, pulled from a real
RotMG install. Its headline is that time-to-die is a **designed constant** ... health and
enemy damage both scale 5x across a whole character, so hits-to-die never moves.
**Progression buys access, never safety.**

## refused, permanently

No affinity meter. No commandable companion. No dailies, no energy, no purchasable
power. No explanation of the Scatter. No music except two cues. No collectible counter
for things worth nothing. No morality system anywhere.

🌙
