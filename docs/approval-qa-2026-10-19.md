# Admin approval verification — 19 October 2026

New submissions and profile/photo edits are pending until reviewed by an MFA administrator. Existing publications retain their prior visibility until edited. Approval never changes public-listing consent or the original six-month expiry.

The member editor shows pending status or the rejection reason. The admin member list includes a pending count and filter; the member detail page previews details/photos and provides Approve and Reject controls. Rejection requires a reason. Decisions are audited and appear in the admin activity timeline.

Every content or photo mutation replaces a random review token. Decisions atomically verify the current token and expiry, write an audit record and rotate the token. Stale or concurrent reviews cannot overwrite a newer revision. Pending/rejected profiles are excluded from public and member discovery, including previously saved/viewed profiles; direct photos remain accessible only to the owner and MFA administrators. New interests and conversations require approved profiles. Internal review tokens/comments are omitted from other members' profile data and anonymous listings.

Validation:

- 54 independent approval integration checks passed: forged approval input, pending visibility, roles/MFA, origin validation, reject/resubmit, stale tokens, private/public consent, photo upload/removal, direct photo access, concurrent decisions, audit attribution and expiry.
- 337 portal integration checks passed with explicit administrator review where editing invalidates previous approval.
- Public registration, login, posting, public consent, privacy, duplicate-account and rate-limit tests passed on the new hostname.
- 25 UI rendering, photo-storage and SQLite tests passed.
- Production build, TypeScript and whitespace checks passed.
- Browser: rejected a fictional post, confirmed its reason in the member editor, edited/resubmitted it, approved the fresh preview, and verified the resulting admin status. Verified the pending-only queue and the approval controls at desktop and 645 px widths, with no horizontal overflow.

All browser and integration posting/review tests used isolated databases and synthetic sessions. No live member was approved or rejected during verification. Live verification checks deployment assets, public pages, service health and denial of unauthenticated review requests.
