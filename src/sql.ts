import { Artifact, ArtifactFile } from "./model";

// These types represent database primary keys, not to be confused with an Artifact ID.
type ArtifactKey = number;
type FileKey = number;

// An artifact file with its database primary key.
type KeyedArtifactFile = ArtifactFile & { key: FileKey };

class Database {
  private readonly db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  insertArtifact = async (artifact: Artifact): Promise<ArtifactKey> => {
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
      throw new Error("inserting new artifact did not return a database ID");
    }

    return artifactKey;
  };

  insertFiles = async (
    artifactKey: ArtifactKey,
    files: Artifact["files"]
  ): Promise<ReadonlyArray<KeyedArtifactFile>> => {
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
          file.hidden
        )
      )
    );

    const fileIds = fileRows.map((row) => row.results[0].id);

    return files.map((file, index) => ({
      key: fileIds[index],
      ...file,
    }));
  };

  prepareArtifactAliases = (
    artifactKey: ArtifactKey,
    aliases: Artifact["aliases"]
  ): ReadonlyArray<D1PreparedStatement> => {
    const aliasStmt = this.db.prepare(`
      INSERT INTO
        artifact_aliases
      VALUES
        (artifact, slug)
    `);

    return aliases.map((alias) => aliasStmt.bind(artifactKey, alias));
  };

  prepareFileAliases = (
    files: ReadonlyArray<Pick<ArtifactFile, "aliases"> & { key: FileKey }>
  ): ReadonlyArray<D1PreparedStatement> => {
    const aliasStmt = this.db.prepare(`
      INSERT INTO
        file_aliases (file, filename)
      VALUES
        (?1, ?2)
    `);

    return files.flatMap((file) => file.aliases.map((alias) => aliasStmt.bind(file.key, alias)));
  };

  prepareLinks = (artifactKey: ArtifactKey, links: Artifact["links"]): ReadonlyArray<D1PreparedStatement> => {
    const stmt = this.db.prepare(`
      INSERT INTO
        links (artifact, name, url)
      VALUES
        (?1, ?2, ?3)
    `);

    return links.map((link) => stmt.bind(artifactKey, link.name, link.url));
  };

  preparePeople = (artifactKey: ArtifactKey, people: Artifact["people"]): ReadonlyArray<D1PreparedStatement> => {
    const stmt = this.db.prepare(`
      INSERT INTO
        people (artifact, name)
      VALUES
        (?1, ?2)
    `);

    return people.map((name) => stmt.bind(artifactKey, name));
  };

  prepareIdentities = (
    artifactKey: ArtifactKey,
    identities: Artifact["identities"]
  ): ReadonlyArray<D1PreparedStatement> => {
    const stmt = this.db.prepare(`
      INSERT INTO
        identities (artifact, name)
      VALUES
        (?1, ?2)
    `);

    return identities.map((name) => stmt.bind(artifactKey, name));
  };

  prepareDecades = (artifactKey: ArtifactKey, decades: Artifact["decades"]): ReadonlyArray<D1PreparedStatement> => {
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
  // is considered orphaned and we can clean it up later if necessary. In practice, we will likely
  // never need to.
  commitArtifact = async (artifactKey: ArtifactKey, artifactId: Artifact["id"]) => {
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
}

// Insert an artifact into the database.
export const insertArtifact = async (d1: D1Database, artifact: Artifact) => {
  let db = new Database(d1);

  let artifactKey = await db.insertArtifact(artifact);

  let keyedFiles = await db.insertFiles(artifactKey, artifact.files);

  await d1.batch([
    ...db.prepareArtifactAliases(artifactKey, artifact.aliases),
    ...db.prepareFileAliases(keyedFiles),
    ...db.prepareLinks(artifactKey, artifact.links),
    ...db.preparePeople(artifactKey, artifact.people),
    ...db.prepareIdentities(artifactKey, artifact.identities),
    ...db.prepareDecades(artifactKey, artifact.decades),
  ]);

  // This query comes last; it atomically commits the artifact to the database.
  db.commitArtifact(artifactKey, artifact.id);
};
