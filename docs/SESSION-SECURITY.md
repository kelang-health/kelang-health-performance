# Hospital Profile session limits

Released in version 1.32 on 8 October 2026. This policy works with Supabase Free and does not change global Auth settings or other applications sharing the project.

- Sign out after 30 minutes without user activity.
- Require a new login after 8 hours from the original Auth session creation, even if the user remains active.
- Show a warning 2 minutes before expiration. Continue can extend inactivity time, but cannot extend the 8-hour limit.
- Token refresh and background reads do not restart either timer. Previously stored sessions without the new timestamps require one new login.

The browser clears its identity and closes private dialogs on expiration. Human pointer, keyboard, input and wheel events update activity; server updates are throttled to one minute. The database independently checks Auth session ownership, creation time, revocation, bans and recorded activity. Server inactivity can expire slightly earlier than the browser because of the heartbeat interval or connectivity loss.

Restrictive RLS guards protect Hospital Profile writes, private reads and personnel photo uploads. The hp-accounts Edge Function also checks the caller's session before account management. Public published information remains readable. Expired server sessions cannot be revived by a heartbeat; login is required.

Validation: 81 automated tests passed; build passed; 10 transactional database checks passed and were rolled back, including idle/absolute expiration, wrong owner, revoked sessions and rejected writes. Browser clock tests verified mobile warnings, continuation and expiration; public publication pages passed desktop/mobile regression checks. Browser login/password entry was not tested with a real user's credentials.

Supabase advisors report the intentional backend-only activity table as [RLS enabled without a policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). The registration RPC intentionally uses [authenticated SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) to read protected Auth metadata; it validates caller identity, session ownership and both deadlines, has an empty search path and is not executable by anonymous users.
