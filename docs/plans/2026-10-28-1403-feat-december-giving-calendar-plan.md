---
title: Giving Calendar - Plan
type: feat
date: 2026-10-28
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Giving Calendar - Plan

## Goal Capsule

Visitors can choose an affordable monthly giving commitment and reach Feed Tulum's existing Donately campaign from the homepage.
Build and verify the requested V1, then deliver a reviewed pull request. The user request and confirmed spelling govern scope. No donation is submitted during testing.

## Product Contract

### Summary

Add a Giving Calendar page for December 2026 and link to it from the homepage.

### Problem Frame

The existing homepage offers general donations. The supplied calendar makes small monthly commitments easier to choose.

### Requirements

- R1. Serve the new page at `/giving-calendar`, with H1 “Help Feed Tulum.” and copy “Each number represents a monthly donation in US dollars. Select a day to start your giving commitment.”
- R2. Show “31 days of giving,” December 2026, Sunday–Saturday headings, and dates 1–31 in their correct weekday positions: December 1 is Tuesday and December 31 is Thursday.
- R3. Every date is a normal link displaying its matching monthly amount ($1/month through $31/month) and opens the existing Donately campaign used by `/donate`.
- R4. Match the site's cream, sand, terracotta, Inter, and Source Serif 4 design; retain a readable seven-column calendar on narrow phones, visible keyboard focus, and accessible names for each date/amount.
- R5. Link the calendar from the homepage navigation and existing donation section, including mobile access.

### Key Decisions

Use the confirmed Feed Tulum spelling (user-directed, chosen over “Feed to Loom”). Governs R1.

### Scope Boundaries

No sponsored/available states, date reservations, donor tracking, payment processing, or new backend. V1 links all dates to the existing campaign URL; amounts and monthly frequency are chosen on Donately. State that handoff in a short note rather than implying preselection.

## Planning Contract

### Key Technical Decisions

- KTD1. Use `giving-calendar/index.html` with self-contained styles and native links, following the static `index.html` architecture. No client-side JavaScript is necessary.
- KTD2. Use the exact destination in `vercel.json`: `https://pages.donately.com/feedtulum/campaign/feed-tulum/`. Keep the existing `/donate` redirect intact and add an explicit rewrite for the clean calendar route.
- KTD3. Use a semantic calendar table with weekday headers and two leading empty cells. Each occupied cell contains a full-size anchor. On phones, shorten visible amounts to “$N/mo” while accessible names retain “US dollars a month.”
- KTD4. Add a navigation item and an understated text link below the existing donation-section paragraph; avoid adding a competing homepage section.

## Implementation Units

### U1. Calendar page and route

**Requirements:** R1–R4. **Dependencies:** none.
**Files:** `giving-calendar/index.html`, `vercel.json`.
**Approach:** Apply KTD1–KTD3; use the existing logo, colors, and fonts with generous desktop spacing and compact mobile spacing.
**Execution note:** This repository has no test runner or build system. Use source assertions and actual browser acceptance rather than adding a test framework for static links.
**Test scenarios:** Verify all 31 dates and amounts; first/last weekday positions; all hrefs equal the known donation destination; keyboard activation; no horizontal overflow or overlapping cells at 320, 375, 768, and 1440 pixels; clean route resolution.
**Verification:** Inspect desktop/mobile screenshots and follow representative first/middle/last dates to Donately without submitting a donation.

### U2. Homepage discovery

**Requirements:** R5. **Dependencies:** U1.
**Files:** `index.html`.
**Approach:** Apply KTD4 using the existing mobile menu and donation card.
**Test scenarios:** Follow both homepage entry points; open mobile menu and use its calendar link; check desktop navigation fit and existing Donate links.
**Verification:** Browser checks confirm the homepage-to-calendar-to-Donately path on desktop and mobile.

## Verification Contract

Use Python's standard-library HTML parser for deterministic date/link assertions and JSON parsing for route checks; use the built-in browser for responsive layout and real navigation. Run `git diff --check`. No repository test/build commands exist. Obtain one independent integrated-diff review and repair confirmed defects.

## Definition of Done

R1–R5 are demonstrated; the existing donation redirect remains correct; review has no unresolved material defects; the feature is available in a pull request with validation evidence. Remove abandoned code. Report any unavailable deployment or live acceptance explicitly.
