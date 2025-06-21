-- Migration number: 0005 	 2025-06-21T14:02:08.813Z
ALTER TABLE tags
RENAME TO tags_old;

CREATE TABLE tags (
  id integer PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL,
  description text,
  UNIQUE (name, kind)
);

CREATE TABLE artifact_tags (
  id integer PRIMARY KEY,
  artifact integer NOT NULL REFERENCES artifacts (id),
  tag integer NOT NULL REFERENCES tags (id),
  UNIQUE (artifact, tag)
);

INSERT INTO
  tags (name, kind)
SELECT DISTINCT
  value,
  key
FROM
  tags_old
WHERE
  artifact IN (SELECT artifact FROM latest_artifacts);

INSERT INTO
  artifact_tags (artifact, tag)
SELECT
  tags_old.artifact,
  tags.id
FROM
  tags_old
JOIN
  tags ON tags_old.value = tags.name AND tags_old.key = tags.kind
WHERE
  tags_old.artifact IN (SELECT artifact FROM latest_artifacts);

DROP TABLE tags_old;
