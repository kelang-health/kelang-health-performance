# STAFF personnel management — version 1.36

All Hospital Profile STAFF accounts can add unit members/heads, edit names, positions, professional levels, employment types, display order and publication status in their assigned facilities. Personnel photos retain their existing scoped permissions.

STAFF cannot move a person to another facility, change division leadership, deactivate/delete personnel, alter source/photo system fields, link user accounts or grant permissions. ADMIN access is preserved. Users without a STAFF assignment gain no new rights. Session expiration guards remain active.

Both browser controls and database RLS enforce the scope. An invoker trigger also protects immutable/system fields, including transfers between two otherwise assigned units. A direct scoped SELECT policy supports INSERT RETURNING for new unpublished rows.

Validation: 85 Node tests; browser simulation of STAFF edit/create/publication with mocked tokens, including hidden cross-unit controls and account links; 12 real database checks covering allow/deny rules and expired sessions. Database fixtures and mutations were rolled back. No real user's password was used.

Security advisors retain existing [backend-only RLS notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and the intentional session-registration [SECURITY DEFINER notice](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), documented in SESSION-SECURITY.md.
