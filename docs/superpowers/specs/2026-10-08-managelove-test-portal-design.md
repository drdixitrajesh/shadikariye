# managelove.com: working administrator and test-member portal

Status: proposed design for owner review. No accounts or credentials have been created, and no production deployment has been changed.

## Requested outcome

The owner should be able to sign in as an administrator and separately sign in as each of the six existing fictional members. They should be able to exercise the existing matrimonial workflows rather than only view static sample cards. Keep the service free to members and preserve the Cloudflare Free hosting requirement.

The current GitHub deployment is commit `5a21c35e520b0ba516d610c0e41a7cbd6fb01950`. Its standalone configuration sets `STANDALONE_MODE=demo`, contains no D1 or photo-storage bindings, and deliberately rejects managed identity headers. The six fictional profiles are code fixtures, not login accounts. Switching that flag off is not a valid authentication solution.

## Proposed first release

Enable an invitation-only test portal on the existing domain. Retain public browsing and the directory. Show clear test labels on fictional profiles, conversations and uploaded test content. Do not represent these accounts as real people or as phone-verified members. Public registration of real members remains unavailable until its verification and recovery arrangements are agreed and implemented.

Create seven accounts: one owner administrator and six test members linked to Ananya Sharma, Ishita Mishra, Meera Jha, Aarav Tripathi, Rohan Shukla and Aditya Joshi. Proposed usernames are `drdixitrajesh`, `ananya.test`, `ishita.test`, `meera.test`, `aarav.test`, `rohan.test` and `aditya.test`. These are proposed usernames, not functioning credentials.

## Authentication and ownership

Add standalone username/password sign-in with server-verified sessions; continue to reject externally supplied managed identity headers. Use individually salted password hashes, a vetted password-hashing method benchmarked against Workers Free CPU limits, and random revocable session tokens stored as hashes. Cookies must be Secure, HttpOnly and SameSite. Enforce session expiry, logout revocation, same-origin mutation checks and database-backed login throttling.

Provision accounts through an owner-operated bootstrap step. Generate distinct, short-lived, single-use activation tokens, store only their hashes, and let each account set its password. Do not commit passwords, activation tokens or session values. There is no shared administrator password. Grant administration by an explicit immutable account ID, not by a name or a client-supplied role. Add administrator MFA before exposing administrator writes.

The owner can reset test-member access through the administrator portal. Owner recovery requires a documented secure recovery procedure before public-member launch. Do not invent a password for a nonexistent current account.

## Storage and existing member features

Use a dedicated Cloudflare D1 test database so the trial accounts cannot access or message future real-member data. Apply the existing profile, identity, reference, interest, message, quota, safety and expiry schema, with added account/session/activation tables. Seed each fictional member as an editable stored test profile with its own immutable identity record and publication dates; do not leave a competing static fixture with the same identity in lookup paths.

For the strictly free test release, store bounded test photo bytes in D1 behind authenticated photo routes rather than enabling a usage-billed storage service. Proposed maximum is five JPEG/PNG/WebP images of 256 KiB each per profile, with strict byte/type checks, metadata removal and private access enforcement. Add an explicit total storage cap. Free-quota exhaustion must fail visibly; it must not silently upgrade the plan.

Permit test members to edit their own mutable details, optional contact email, two consenting test references and photos; preserve locked names and birth dates. Exercise mutual interests and messages, 20 distinct other profiles per India-time day, own-profile deletion, and six-calendar-month expiry. Administrators may search and delete test profiles with name confirmation, a reason and an audit entry. Deletion must remove associated test content and photos through the existing cleanup semantics.

Test access is a separate server-side permission, not fake mobile OTP success. Its authorization can apply only to the isolated test database and explicitly marked accounts. Never show a mobile-verified badge without a real completed phone verification. Preserve the existing real-member mobile-OTP checks for any future real-member environment.

## Visible copy

Keep “संस्कारों से जुड़ें, परंपरा के साथ।” and the existing संयोजक contact details. Restore “कोई छिपा शुल्क नहीं” in the primary free-service notice. Replace the current blanket “सदस्य सेवाएं जल्द उपलब्ध होंगी” notice with accurate sign-in and test-portal instructions once the portal genuinely works. Explain that test accounts exercise workflows using fictional information.

## Completion evidence

Verify owner activation, administrator MFA and login, each of six separate member logins, account isolation, forged-header rejection, brute-force throttling, session expiry/logout and blocked member access to administrator endpoints. Verify profile edits, email/reference/photo persistence, reciprocal messaging, quotas, identity locks, owner/admin deletion and expiry. Confirm photo permissions and storage limits. Retain the existing integration checks.

Only claim completion after deploying the tested source to the existing Cloudflare Worker, checking the live domain and redirects, signing in as the owner and at least two test members, and demonstrating persistent edits and a reversible test conversation. Verify the GitHub commit associated with that deployment. Provide working portal navigation and secure account activation instructions.

## Access dependency

This conversation currently has GitHub access but no callable Cloudflare connector or deployment credential. The earlier deployment notes refer to a BWS-injected credential in another Codex environment. That credential has not been made available here. Deployment requires an authorized secure account connection or execution from the original Cloudflare-enabled Codex environment; never request passwords, API tokens or OTP codes in chat.
