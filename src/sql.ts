import { Artifact, ArtifactFile } from "./model";

type ArtifactId = number;

class Database {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  insertArtifact = async (artifact: Artifact): Promise<ArtifactId> => {
    const artifactId = await this.db
      .prepare(
        `
        INSERT INTO
          artifacts (key, version, slug, title, summary, description, from_year, to_year)
        VALUES (
          ?1,
          (
            SELECT
              IFNULL(MAX(version), 0) + 1
            FROM
              artifacts
            WHERE
              key = ?1
          ),
          ?2,
          ?3,
          ?4,
          ?5,
          ?6,
          ?7
        )
        RETURNING
          id
      `
      )
      .bind(
        artifact.id,
        artifact.slug,
        artifact.title,
        artifact.summary,
        artifact.description,
        artifact.from_year,
        artifact.to_year
      )
      .first<number>("id");

    if (artifactId == null) {
      throw new Error("inserting new artifact did not return a database ID");
    }

    const insertArtifactAliasStmt = this.db.prepare(`
      INSERT INTO
        artifact_aliases
      VALUES
        (artifact, slug)
    `);

    await this.db.batch(artifact.aliases.map((alias) => insertArtifactAliasStmt.bind(artifactId, alias)));

    return artifactId;
  };

  insertFiles = async (artifactId: ArtifactId, files: ReadonlyArray<ArtifactFile>) => {
    const insertFileStmt = this.db.prepare(`
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

    const fileRows = await this.db.batch<{ id: number }>(
      files.map((file) =>
        insertFileStmt.bind(
          artifactId,
          file.filename,
          file.name,
          file.media_type,
          file.multihash,
          file.lang,
          file.hidden
        )
      )
    );

    const fileIds = fileRows.map((row) => row.results[0].id);

    const insertFileAliasStmt = this.db.prepare(`
      INSERT INTO
        file_aliases (file, filename)
      VALUES
        (?1, ?2)
    `);

    await this.db.batch(
      files.flatMap((file) => file.aliases.map((alias, index) => insertFileAliasStmt.bind(fileIds[index], alias)))
    );
  };
}
