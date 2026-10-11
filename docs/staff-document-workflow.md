# Staff document workflow (release 1.74)

The existing hp_staff_documents table stores the editable working copy and up to 10 confirmed snapshots. No extra persistent tables or Pro features are required.

- Drafts remain editable and printable for review. Only ADMIN or STAFF assigned to the personnel facility can confirm readiness. Confirmation is a completeness check, not an official approval or attendance calculation.
- A save supplies the loaded revision + 1 and filters the PATCH by the loaded revision. Zero returned rows leaves the form open for comparison. The database trigger also rejects content changes without a version increment.
- Confirmed data cannot be edited in place. Save as draft first; previously confirmed copies remain immutable and accessible from history. Documents with issued history cannot be deleted.
- Confirmation captures data, actor, server time and render_version. The renderer directory src/staff/renderers/1.74 is frozen. Future print changes must create a new directory and extend the version dispatcher while keeping existing versions available. Official source assets must retain their pinned hashes or move to newly versioned paths.
- History is loaded on demand. The normal list loads only the selected person and fiscal year, excluding snapshot payloads.
- preview_opened_at means the print preview was opened. It does not prove paper printing, signing, approval or successful PDF saving. Existing printed_at values remain legacy metadata.
- The limit of 10 confirmed copies prevents unbounded JSON growth. No automatic purge removes issued history. Archival must be designed before this cap is reached.

Verification: JS readiness/identity/revision tests, PostgreSQL transactions with simulated authenticated role/session claims, and browser pagination checks. A private encrypted data backup was restored into temporary tables and compared by complete row hashes. This rehearsal excludes full schema, Auth and Storage disaster recovery. Recovery keys and backups must be kept outside the public repository and copied to a separate protected device.

Design & Developed by Apiwat Meethong.
