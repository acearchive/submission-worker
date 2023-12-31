-- Migration number: 0000 	 2023-10-01T20:08:40.343Z
CREATE TABLE
  "artifacts" (
    "id" integer PRIMARY KEY,
    "slug" text NOT NULL,
    "title" text NOT NULL,
    "summary" text NOT NULL,
    "description" text,
    "from_year" integer NOT NULL,
    "to_year" integer
  );

CREATE TABLE
  "artifact_versions" (
    "id" integer PRIMARY KEY,
    "artifact_id" text NOT NULL,
    "version" integer NOT NULL,
    "artifact" integer NOT NULL UNIQUE REFERENCES "artifacts" ("id"),
    "created_at" integer NOT NULL,
    UNIQUE ("artifact_id", "version")
  );

CREATE TABLE
  "artifact_aliases" (
    "id" integer PRIMARY KEY,
    "artifact" integer NOT NULL REFERENCES "artifacts" ("id"),
    "slug" text NOT NULL,
    UNIQUE ("artifact", "slug")
  );

CREATE TABLE
  "links" (
    "id" integer PRIMARY KEY,
    "artifact" integer NOT NULL REFERENCES "artifacts" ("id"),
    "name" text NOT NULL,
    "url" text NOT NULL
  );

CREATE TABLE
  "files" (
    "id" integer PRIMARY KEY,
    "artifact" integer NOT NULL REFERENCES "artifacts" ("id"),
    "filename" text NOT NULL,
    "name" text NOT NULL,
    "media_type" text,
    "multihash" text NOT NULL,
    "lang" text,
    "hidden" boolean NOT NULL,
    UNIQUE ("artifact", "filename")
  );

CREATE TABLE
  "file_aliases" (
    "id" integer PRIMARY KEY,
    "file" integer NOT NULL REFERENCES "files" ("id"),
    "filename" text NOT NULL,
    UNIQUE ("file", "filename")
  );

CREATE TABLE
  "people" (
    "id" integer PRIMARY KEY,
    "artifact" integer NOT NULL REFERENCES "artifacts" ("id"),
    "name" text NOT NULL,
    UNIQUE ("artifact", "name")
  );

CREATE TABLE
  "identities" (
    "id" integer PRIMARY KEY,
    "artifact" integer NOT NULL REFERENCES "artifacts" ("id"),
    "name" text NOT NULL,
    UNIQUE ("artifact", "name")
  );

CREATE TABLE
  "decades" (
    "id" integer PRIMARY KEY,
    "artifact" integer NOT NULL REFERENCES "artifacts" ("id"),
    "decade" integer NOT NULL,
    UNIQUE ("artifact", "decade")
  );
