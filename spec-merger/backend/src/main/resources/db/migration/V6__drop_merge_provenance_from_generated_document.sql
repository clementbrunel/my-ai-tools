-- Superseded by the session table (V5): which Word/JXML documents a merge came from, and the
-- GitLab selection it carries, are now tracked once per session instead of duplicated on the
-- MERGED document row.
ALTER TABLE generated_document DROP COLUMN word_document_id;
ALTER TABLE generated_document DROP COLUMN jxml_document_id;
ALTER TABLE generated_document DROP COLUMN gitlab_selection_json;
