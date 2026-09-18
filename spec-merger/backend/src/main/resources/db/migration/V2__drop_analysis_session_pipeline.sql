-- The field-by-field divergence pipeline (AnalysisSession/Divergence/DocumentVersion) is
-- replaced by a stateless AI merge of the two independently generated markdown specs — see
-- issue #263. Drop in dependency order (document_version/divergence FK analysis_session).
DROP TABLE IF EXISTS document_version;
DROP TABLE IF EXISTS divergence;
DROP TABLE IF EXISTS analysis_session;
