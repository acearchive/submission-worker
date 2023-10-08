import { Artifact, ArtifactFile } from "./model";

// These types represent database primary keys, not to be confused with an Artifact ID.
type ArtifactKey = number;
type FileKey = number;

// An artifact file with its database primary key.
type KeyedArtifactFile = ArtifactFile & { key: FileKey };

export class InsertQuery {
  private readonly db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  private insertArtifact = async (artifact: Artifact): Promise<ArtifactKey> => {
    console.log("Inserting into `artifacts` table");

    const artifactKey = await this.db
      .prepare(
        `
        INSERT INTO
          artifacts (slug, title, summary, description, from_year, to_year)
        VALUES
          (?1, ?2, ?3, ?4, ?5, ?6)
        RETURNING
          id
        `
      )
      .bind(
        artifact.slug,
        artifact.title,
        artifact.summary,
        artifact.description ?? null,
        artifact.from_year,
        artifact.to_year ?? null
      )
      .first<number>("id");

    if (artifactKey == null) {
      throw new Error("Inserting new artifact did not return a database ID");
    }

    return artifactKey;
  };

  private insertFiles = async (
    artifactKey: ArtifactKey,
    files: Artifact["files"]
  ): Promise<ReadonlyArray<KeyedArtifactFile>> => {
    if (files.length === 0) {
      console.log("There are no files to insert");
      return [];
    }

    console.log("Inserting into `files` table");

    const fileStmt = this.db.prepare(`
        INSERT INTO
          files (artifact, filename, name, media_type, multihash, lang, hidden)
        VALUES (
          ?1,
          ?2,
          ?3,
          ?4,
          ?5,
          ?6,
          ?7
        )
        RETURNING
          id
    `);

    const fileRows = await this.db.batch<{ id: FileKey }>(
      files.map((file) =>
        fileStmt.bind(
          artifactKey,
          file.filename,
          file.name,
          file.media_type ?? null,
          file.multihash,
          file.lang ?? null,
          file.hidden ? 1 : 0
        )
      )
    );

    const fileIds = fileRows.map((row) => row.results[0].id);

    return files.map((file, index) => ({
      key: fileIds[index],
      ...file,
    }));
  };

  private prepareArtifactAliases = (
    artifactKey: ArtifactKey,
    aliases: Artifact["aliases"]
  ): ReadonlyArray<D1PreparedStatement> => {
    if (aliases.length === 0) {
      console.log("There are no artifact aliases to insert");
      return [];
    }

    const aliasStmt = this.db.prepare(`
      INSERT INTO
        artifact_aliases (artifact, slug)
      VALUES
        (?1, ?2)
    `);

    return aliases.map((alias) => aliasStmt.bind(artifactKey, alias));
  };

  private prepareFileAliases = (
    files: ReadonlyArray<Pick<ArtifactFile, "aliases"> & { key: FileKey }>
  ): ReadonlyArray<D1PreparedStatement> => {
    if (files.length === 0) {
      console.log("There are no file aliases to insert");
      return [];
    }

    const aliasStmt = this.db.prepare(`
      INSERT INTO
        file_aliases (file, filename)
      VALUES
        (?1, ?2)
    `);

    return files.flatMap((file) => file.aliases.map((alias) => aliasStmt.bind(file.key, alias)));
  };

  private prepareLinks = (artifactKey: ArtifactKey, links: Artifact["links"]): ReadonlyArray<D1PreparedStatement> => {
    if (links.length === 0) {
      console.log("There are no links insert");
      return [];
    }

    const stmt = this.db.prepare(`
      INSERT INTO
        links (artifact, name, url)
      VALUES
        (?1, ?2, ?3)
    `);

    return links.map((link) => stmt.bind(artifactKey, link.name, link.url));
  };

  private preparePeople = (
    artifactKey: ArtifactKey,
    people: Artifact["people"]
  ): ReadonlyArray<D1PreparedStatement> => {
    if (people.length === 0) {
      console.log("There are no people to insert");
      return [];
    }

    const stmt = this.db.prepare(`
      INSERT INTO
        people (artifact, name)
      VALUES
        (?1, ?2)
    `);

    return people.map((name) => stmt.bind(artifactKey, name));
  };

  private prepareIdentities = (
    artifactKey: ArtifactKey,
    identities: Artifact["identities"]
  ): ReadonlyArray<D1PreparedStatement> => {
    if (identities.length === 0) {
      console.log("There are no identities to insert");
      return [];
    }

    const stmt = this.db.prepare(`
      INSERT INTO
        identities (artifact, name)
      VALUES
        (?1, ?2)
    `);

    return identities.map((name) => stmt.bind(artifactKey, name));
  };

  private prepareDecades = (
    artifactKey: ArtifactKey,
    decades: Artifact["decades"]
  ): ReadonlyArray<D1PreparedStatement> => {
    if (decades.length === 0) {
      console.log("There are no decades to insert");
      return [];
    }

    const stmt = this.db.prepare(`
      INSERT INTO
        decades (artifact, decade)
      VALUES
        (?1, ?2)
    `);

    return decades.map((decade) => stmt.bind(artifactKey, decade));
  };

  // We can't batch every insertion into one atomic transaction because we need to set up the
  // foreign key relationships and D1 doesn't allow manual transactions. Instead, we use the
  // `artifact_versions` table to maintain atomicity. We write to this table last, after all the
  // rest of the artifact data is committed.
  //
  // If there is a row in `artifacts` without a corresponding row in `artifact_versions`, that data
  // is considered orphaned and we can clean it up later if necessary. In practice, we will probably
  // never need to; the database will likely stay quite small.
  private commitArtifact = async (artifactKey: ArtifactKey, artifactId: Artifact["id"]) => {
    console.log("Inserting into `artifact_versions` table");

    await this.db
      .prepare(
        `
        INSERT INTO
          artifact_versions (artifact_id, version, artifact, created_at)
        VALUES (
          ?1,
          (
            SELECT
              IFNULL(MAX(version), 0) + 1
            FROM
              artifact_versions
            WHERE
              artifact_id = ?1
          ),
          ?2,
          unixepoch('now')
        )
        `
      )
      .bind(artifactId, artifactKey)
      .run();
  };

  run = async (artifact: Artifact) => {
    const artifactKey = await this.insertArtifact(artifact);

    const keyedFiles = await this.insertFiles(artifactKey, artifact.files);

    console.log("Performing batch insert queries");

    await this.db.batch([
      ...this.prepareArtifactAliases(artifactKey, artifact.aliases),
      ...this.prepareFileAliases(keyedFiles),
      ...this.prepareLinks(artifactKey, artifact.links),
      ...this.preparePeople(artifactKey, artifact.people),
      ...this.prepareIdentities(artifactKey, artifact.identities),
      ...this.prepareDecades(artifactKey, artifact.decades),
    ]);

    // This query comes last; it atomically commits the artifact to the database.
    await this.commitArtifact(artifactKey, artifact.id);

    console.log("Finished inserting new artifact");
  };
}
