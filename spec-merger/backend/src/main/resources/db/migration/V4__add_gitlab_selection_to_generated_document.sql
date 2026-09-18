-- Lets a MERGED document also carry the GitLab project selection (repo, entry point, selected
-- files) it was generated from — opaque JSON as far as the backend is concerned, only ever
-- written/read by the frontend — so a single merged document id is enough to export/import a
-- whole session (the 3 documents + the selected GitLab project) to/from another machine.
ALTER TABLE generated_document ADD COLUMN gitlab_selection_json TEXT;
