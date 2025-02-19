-- Migration number: 0002 	 2025-02-19T13:11:43.323Z
CREATE VIEW latest_artifacts ("artifact", "artifact_id", "created_at") AS
SELECT
  artifact,
  artifact_id,
  created_at
FROM
  artifact_versions
GROUP BY
  artifact_id
HAVING
  version = MAX(version);
