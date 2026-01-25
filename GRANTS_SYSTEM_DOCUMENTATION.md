# Feed Tulum Grants System - User Guide

## What Is This?

The Feed Tulum Grants System is a Kanban board that helps you manage grant applications. It lives at **feedtulum.com/grants** and tracks grants from initial consideration through submission.

---

## How to Access

1. Go to **https://feedtulum.com/grants**
2. Enter password: `FeedTulum!Grants2026`
3. Click "Login"

---

## How the Dashboard Works

### The Kanban Board

After logging in, you'll see a board with 3 columns:

```
┌─────────────────┬─────────────────┬─────────────────┐
│  TO CONSIDER    │   IN PROGRESS   │    SUBMITTED    │
├─────────────────┼─────────────────┼─────────────────┤
│                 │                 │                 │
│  Grants you're  │  Currently      │  Completed      │
│  researching    │  working on     │  applications   │
│                 │                 │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

### Moving Grants Between Columns

**Simply drag and drop cards between columns:**
- Start researching a grant? → Drag from "To Consider" to "In Progress"
- Submitted an application? → Drag to "Submitted"
- Changed your mind? → Drag back to "To Consider"

Your positions are saved automatically. When you return, grants will be exactly where you left them.

---

## Understanding Grant Cards

### Collapsed View

Each grant card shows:
- **Grant Name**: E.g., "Global Fund for Children Partnership Grant"
- **Funder**: Who provides the grant
- **Amount**: Grant size (e.g., "$25,000 - $75,000")
- **Deadline**: When it's due (color-coded for urgency)
  - 🟢 Green = 30+ days away
  - 🟠 Orange = 14-30 days away
  - 🔴 Red = Less than 14 days (urgent!)
- **Priority**: Star rating (1-5 stars)

### Expanded View

**Click any card to expand it** and see:

1. **Description**: What the grant funds
2. **Why We Qualify**: Why Feed Tulum is eligible
3. **Application Materials**: Pre-written content ready to copy
4. **Submission Instructions**: Step-by-step guide to apply

---

## How to Apply for a Grant

### Step 1: Choose a Grant
- Review grants in "To Consider" column
- Click to expand and read details
- Check the deadline and priority

### Step 2: Move to "In Progress"
- Drag the grant card to "In Progress" column

### Step 3: Prepare Application
- Expand the grant card
- Scroll to "Application Materials" section
- Each material has a **Copy** button

### Step 4: Copy and Customize Materials
For each required material:
1. Click the **Copy** button next to the material
2. Paste into your email/form/portal
3. Review and make any necessary adjustments
4. The materials are pre-written to match each grant's specific requirements

### Step 5: Follow Submission Instructions
- Scroll to "Submission Instructions"
- Follow each step in order
- Most grants require:
  - Email application
  - Specific attachments (501(c)(3) letter, Form 990, etc.)
  - Subject line and body text (provided in materials)

### Step 6: Mark as Submitted
- After sending the application, drag the card to "Submitted" column
- This keeps your board organized and tracks what you've completed

---

## Current Grants (6 Total)

### Immediately Available (3 grants)
These are ready to apply right now:

1. **Global Fund for Children** - $25K-$75K, rolling deadline
2. **Conservation, Food & Health Foundation** - $25K-$50K, food security focus
3. **W.K. Kellogg Foundation** - $100K-$300K, priority for Latin America

### Future Options (3 grants) 🇲🇽
These require Feed Tulum to establish Mexican nonprofit status first:

4. **Inter-American Foundation** - Community development in Latin America
5. **Fundación Comunitaria Cozumel** - Quintana Roo regional focus
6. **Fundación Televisa** - Education, health, nutrition for Mexican children

---

## Tips for Success

### Deadline Management
- Check deadlines regularly (shown on each card)
- Prioritize red and orange deadlines first
- "Rolling" deadlines = apply anytime

### Quality Over Speed
- Read the entire grant card before applying
- Customize the materials if needed (though they're pre-customized to each grant)
- Double-check you've included all required attachments

### Document Checklist
Keep these documents ready (most grants require them):
- [ ] 501(c)(3) determination letter (PDF)
- [ ] Most recent Form 990 (PDF)
- [ ] Current year budget
- [ ] Board member list (some grants)

### Email Applications
For email-based applications:
1. Copy the "Email Subject" exactly as written
2. Copy the "Email Body"
3. Attach required documents
4. Send to the email address in the instructions
5. Consider sending yourself a BCC for records

---

## Frequently Asked Questions

**Q: Can I edit the materials?**
A: Yes! The materials are pre-written to match each grant's requirements, but you can customize them as needed.

**Q: What if I made a mistake moving a card?**
A: Just drag it back! There's no penalty for moving cards around.

**Q: Do I need to apply to all 6 grants?**
A: No. Apply only to grants that make sense for Feed Tulum's current capacity and mission.

**Q: What about the Mexican nonprofit grants?**
A: Those 3 grants (marked 🇲🇽) are for future consideration after Feed Tulum establishes legal status in Mexico.

**Q: Can I access this from my phone?**
A: Yes! The dashboard is mobile-responsive. The columns stack vertically on smaller screens.

**Q: What if I forget the password?**
A: Contact the person who set up the system. Password: `FeedTulum!Grants2026`

**Q: How do I add new grants?**
A: You'll need developer access to edit the grants data. See "Technical Overview" section below.

---

## Technical Overview

*For developers or technical administrators*

### Architecture
- **Frontend**: Single-page HTML/CSS/JavaScript application
- **File**: `/grants/index.html` (52KB, ~980 lines)
- **Drag-and-Drop**: SortableJS library (CDN)
- **Storage**: Browser localStorage (positions persist locally)
- **Auth**: Vercel serverless function at `/api/auth.js`
- **Hosting**: Vercel (auto-deploys from GitHub)
- **Repository**: https://github.com/mattd3080/feedtulum-website.git

### File Structure
```
grant hunter/
├── grants/
│   └── index.html          # Main dashboard (all-in-one file)
├── api/
│   └── auth.js             # Password verification
└── vercel.json             # Deployment config
```

### How It Works
1. User enters password
2. `POST /api/auth` verifies password
3. Session stored in `sessionStorage`
4. Dashboard displays with grants from `testGrants` array
5. SortableJS enables drag-and-drop
6. Card positions saved to `localStorage` on every drag
7. Positions restored on page reload

### Making Changes

**To update grant data:**
1. Edit `/grants/index.html`
2. Find `let testGrants = [...]` array (starts around line 517)
3. Add/edit grant objects
4. Commit and push to GitHub
5. Vercel auto-deploys in ~30-45 seconds

**To change password:**
1. Edit `/api/auth.js`
2. Change hardcoded password string
3. Commit and push

**To add new features:**
- All code is in `/grants/index.html`
- CSS starts around line 50
- JavaScript starts around line 515
- SortableJS CDN: `https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js`

### localStorage Keys
- `grantCardPositions`: JSON object with `{consider: [], progress: [], submitted: []}`
- Each array contains grant IDs in display order

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Requires localStorage enabled

---

## Support

**Issues or Questions?**
- Developer documentation: See source code comments in `/grants/index.html`
- Full session history: Available in Claude Code conversation logs
- Emergency restore: Original repo at `/Users/mattdalley/feedtulum-website/`

**Making Updates:**
All changes made to files in this directory automatically deploy to the live site at https://feedtulum.com/grants via Vercel.

---

## Quick Start Checklist

- [ ] Access https://feedtulum.com/grants
- [ ] Login with password: `FeedTulum!Grants2026`
- [ ] Review all 6 grants in "To Consider" column
- [ ] Gather required documents (501(c)(3) letter, Form 990)
- [ ] Choose 1-2 grants to apply for first
- [ ] Drag chosen grants to "In Progress"
- [ ] Follow submission instructions for each grant
- [ ] Move to "Submitted" when complete
- [ ] Track success and follow up as needed

---

**Last Updated**: January 24, 2026
**System Version**: V2 (Kanban Board)
**Live URL**: https://feedtulum.com/grants
