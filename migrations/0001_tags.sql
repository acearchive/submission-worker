-- Migration number: 0001 	 2025-02-19T06:44:26.531Z
CREATE TABLE "tags" (
  "id" integer PRIMARY KEY,
  "artifact" integer NOT NULL REFERENCES "artifacts" ("id"),
  "key" text NOT NULL,
  "value" text NOT NULL,
  UNIQUE ("artifact", "key", "value")
);

INSERT INTO
  "tags" ("artifact", "key", "value")
SELECT
  "artifact",
  'person',
  "name"
FROM
  "people";

INSERT INTO
  "tags" ("artifact", "key", "value")
SELECT
  "artifact",
  'identity',
  "name"
FROM
  "identities";

INSERT INTO
  "tags" ("artifact", "key", "value")
SELECT
  "artifact",
  'decade',
  "decade"
FROM
  "decades";

DROP TABLE "people";

DROP TABLE "identities";

DROP TABLE "decades";
