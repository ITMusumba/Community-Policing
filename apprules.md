# App Rules — Community Policing

These are the rules and the product plan for the Community Policing app. Anyone building on this repository (people or AI coding tools) must follow them. When a design or code decision conflicts with these rules, the rules win; change this file first if a rule needs to change.

## Purpose

A citizen anywhere in Uganda can report a crime as it happens, quickly and anonymously, using photos and automatic GPS location, and can follow up later. Police see incoming reports as a scrolling feed, filter them by area, assign them to stations and officers, and track the response.

---

## Core rules (non-negotiable)

### Rule 1 — Built for every user, including people who cannot read

- **Icons, pictures and colour first; words second.** Every action and category has a clear pictogram. Text labels are supporting, never the only way to understand something.
- **Voice everywhere.** A citizen can record a voice note instead of typing anything. Key screens have a speaker button that reads the screen aloud.
- **Local languages.** Interface and audio prompts in English, Luganda, Lusoga, Runyankole/Rukiga, Acholi, Ateso, Lugbara and Swahili at minimum. Language is chosen with flag-free pictures/audio on first launch and changeable at any time.
- **One thing per screen.** No forms on the quick-report path. No typing required to submit a report.
- **Big targets.** Buttons at least 56 px tall, high contrast, works in bright sunlight.
- **Numbers over letters.** The tracking code is short and also shown as large digits so it can be read aloud or written on paper.
- **Test with real users** who have low literacy before each release, on low-end Android phones.

### Rule 2 — Mobile first

- Design for a small, cheap Android phone on a slow or intermittent connection first; tablet and desktop layouts come after.
- **Offline-first reporting:** a report is saved on the phone and sent automatically when the network returns. The user is told it is "waiting to send" with an icon, not an error.
- **Compress photos and video on the phone** before upload; keep data usage low.
- Fast start: the camera must be one tap from opening the app.
- Police screens are also mobile first — officers work from phones in the field.

### Rule 3 — Anonymity is always available

- **A citizen never needs an account, name, phone number or email to report or follow up.** Accounts are optional and only for convenience.
- Follow-up works with a **tracking code** shown to the reporter plus a secret token kept on the device (stored only as a hash on the server).
- **Strip photo metadata** (device model, owner, other EXIF) except the GPS captured for the report.
- **Do not log IP addresses or device identifiers against reports.** Abuse controls must work without identifying the reporter.
- Anonymous messages between citizen and officer never reveal the citizen's identity, even to admins.
- If a citizen chooses to give contact details, it is opt-in per report, shown only to the assigned officer, and can be withdrawn.
- No feature may be added that makes anonymity optional for the police side or removes it by default.

---

## Citizen side

### Quick report (target: under 15 seconds)

1. Open app → large camera button.
2. Take one or more photos or a short video (or record a voice note).
3. Optional one-tap category picture.
4. Send.

- GPS and its accuracy are captured automatically. If GPS is weak, the user can drag a pin on a map.
- After sending, the phone shows the **tracking code** (e.g. `CP-7K4Q-92`) in large characters, and reads it aloud.

### Add details later (optional)

Using the tracking code, the citizen can add:
- a voice note or typed description
- more photos or video
- suspect or vehicle description
- the time it happened
- whether they are willing to be contacted

### Follow-up

- Status timeline shown with icons: Received → Seen → Assigned → Officer on the way → Closed.
- Anonymous chat (text or voice) with the assigned officer.
- Optional account to see all of one's reports in one place.

### Safety

- A large **"Emergency? Call 999 / 112"** button on the home screen. The app states clearly that it does not replace emergency lines.
- Faces of victims and bystanders are blurred in the police feed; the original is visible only to authorised officers.

### Crime categories (with pictograms)

Theft, robbery, assault, domestic violence, sexual violence, accident, fire, drugs, suspicious activity, livestock theft, land/property dispute, other.

Complaints *about police conduct* are a separate flow (the existing `complaints` table), not a crime-report category.

---

## Police side

### The feed

- **Vertical full-screen feed** (TikTok-style): one report per screen, swipe up for the next.
- Each card: photo/video, category icon, time since posting, distance from the officer, and location (village → parish → subcounty → district).
- **Quick actions:** Verify, Assign, Escalate, Mark duplicate, Mark false/spam.
- **Filters:** Region → District → County → Subcounty → Parish → Village, plus category, status, time range and "my station's area".
- **Duplicate grouping:** reports close in place and time (e.g. within 300 m and 30 minutes) are grouped into one incident.
- List view and map view of the same reports for desk officers.

### Assignment and oversight

- Each report is **automatically routed to a station** based on which station area its GPS point falls in.
- Station commanders assign reports to officers; officers update status from their phones.
- Every status change and assignment is written to the audit log.
- **Access follows the police structure:** an officer sees their station's area; a district commander sees the district; regional and HQ admins see wider areas.
- Dashboards by area: open reports, time to first response, time to resolve, overdue reports, hotspot maps.

---

## Automatic location lookup

- Load Uganda administrative boundaries (UBOS: district, county, subcounty, parish, village where available).
- Every report is matched to the area its GPS point falls in. The citizen never types a location.
- **Police station areas** are stored separately from administrative areas and can be redrawn by admins.

## Stations and community policing map

- `stations` table: name, type (station / post / community policing point), coordinates, phone, area covered, verified flag, last confirmed date.
- Public map of nearest stations with distance and tap-to-call.
- **Updates:** police admins edit directly; community police officers and the public can *suggest* changes, which go live only after admin verification.

---

## Data model changes needed

| Change | Purpose |
|---|---|
| `reports.reporterId` optional; add `trackingCode` and `followUpTokenHash` | Anonymous reporting with follow-up |
| Crime categories as listed above | Match the app's purpose; misconduct moves to `complaints` |
| Admin-area fields (district, county, subcounty, parish, village IDs) with indexes | Filtering and routing |
| `stationId` on reports and officer profiles | Station-based assignment and access |
| `reportMedia` table using Convex file storage (photos, video, voice notes) | Evidence |
| `incidentClusterId` | Duplicate grouping |
| `adminAreas` and `stations` tables | Location lookup and map |
| `language` preference (device-side for anonymous users) | Local-language interface |

---

## Risks and controls

- **False and malicious reports:** rate limits per device, a device trust score that rises when officers verify its reports, and the ability to deprioritise (not block) unverified devices — all without identifying the reporter.
- **Privacy of people in photos:** face blurring in the feed; originals restricted.
- **Data protection:** comply with the Data Protection and Privacy Act, 2019, including registration with the Personal Data Protection Office. Decide early whether data must be hosted in Uganda; Convex offers a self-hosted option if required.
- **Connectivity:** offline queue, compressed media, and a later USSD/SMS reporting channel for people without smartphones.

---

## Build order

**Done (demo):** schema, anonymous quick report, nearest-station routing, live police feed, assignment and actions, anonymous follow-up, super-admin user management.

**Next — leave demo mode (in this order):**
1. **Professional police interface** — apply the "Professional standard" rules below across police and admin screens.
2. **Android app** — Capacitor native project, native camera/GPS/permissions, secure session storage, signed release build, tested on a low-end phone.
3. **Face blurring** — on the phone before upload where possible; originals visible only to authorised officers; every view of an original is audit-logged.
4. **Dashboards** — by station, district, region and HQ: open reports, time to first response, time to resolve, overdue, hotspots.
5. Real location lookup (UBOS boundaries), duplicate grouping, station map with moderated updates, data-retention rules.
6. **Local languages** — remaining language packs and audio prompts.
7. **Drag-a-pin location** when GPS is weak (until then, the station picker is the fallback).

## Professional standard (police and admin screens)

- Sober, institutional look: dark navy and white, restrained accents; no emoji on police or admin screens — use a consistent line-icon set.
- Formal language: "Incident", "Occurrence", "Acknowledge", "Dispatch", "Escalate", "Close with outcome" — not casual wording.
- Each incident has a formal reference number alongside the citizen tracking code.
- Consequential actions (close, mark false, escalate) require a reason and a confirmation; all are audit-logged.
- Priority levels (P1–P4) and response timers are visible on every incident.
- The feed shows the information an officer needs to act, not entertainment: time, location, category, priority, evidence, status, assigned officer.
- Citizen screens stay simple and pictorial (Rule 1), but use a calm, official tone and carry the app's official identity and a clear privacy notice.
