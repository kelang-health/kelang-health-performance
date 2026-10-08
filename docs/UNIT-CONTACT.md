# Short unit contact messages — version 1.39

Use Units → select a unit → Contact → Edit contact information → Manage unit information. Address and telephone retain their existing fields. The new contact_message is plain text, at most 500 characters, for a short introduction and HTTPS website/social links. No attachments or history table is added; edits overwrite the existing unit row.

STAFF edit only assigned units and save drafts. ADMIN retain review/publication controls. Unpublished messages remain hidden from visitors. The UI escapes HTML and links only valid HTTPS URLs; the database independently enforces the length limit. GitHub Pages hosts the frontend; Supabase stores the small existing row.

Verified with 87 automated tests, four transactional database checks (own-unit write, draft state, cross-unit denial, oversized text rejection; all rolled back), and mobile browser checks for safe text, links and editor limits.

Security advisors retain the previously documented [backend-only table notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and intentional [session registration function notice](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). See SESSION-SECURITY.md.
