-- Migration number: 0003 	 2025-02-21T05:39:13.578Z
CREATE TABLE "artifact_versions_backup" (
  "id" integer PRIMARY KEY,
  "artifact_id" text NOT NULL,
  "version" integer NOT NULL,
  "artifact" integer NOT NULL UNIQUE REFERENCES "artifacts" ("id"),
  "created_at" integer NOT NULL,
  UNIQUE ("artifact_id", "version")
);

INSERT INTO
  artifact_versions_backup (id, artifact_id, version, artifact, created_at)
SELECT
  id,
  artifact_id,
  version,
  artifact,
  created_at
FROM
  artifact_versions;

DROP VIEW latest_artifacts;

DROP TABLE artifact_versions;

-- It is impossible to create a DEFAULT CURRENT_TIMESTAMP column in SQLite using ALTER TABLE.
CREATE TABLE "artifact_versions" (
  "id" integer PRIMARY KEY,
  "artifact_id" text NOT NULL,
  "version" integer NOT NULL,
  "artifact" integer NOT NULL UNIQUE REFERENCES "artifacts" ("id"),
  "created_at" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("artifact_id", "version")
);

INSERT INTO
  artifact_versions (id, artifact_id, version, artifact, created_at)
SELECT
  id,
  artifact_id,
  version,
  artifact,
  datetime (created_at, 'unixepoch')
FROM
  artifact_versions_backup;

DROP TABLE artifact_versions_backup;

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
