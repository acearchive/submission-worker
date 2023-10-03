import { Artifact, ArtifactFile, ArtifactLink } from "./model";

type ArtifactId = number;
type FileId = number;

type ArtifactData = Pick<Artifact, "slug" | "title" | "summary" | "description" | "from_year" | "to_year">;

class Database {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  insertArtifact = async (artifact: ArtifactData): Promise<ArtifactId> => {
    const artifactId = await this.db
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

    if (artifactId == null) {
      throw new Error("inserting new artifact did not return a database ID");
    }

    return artifactId;
  };

  insertArtifactAliases = async (artifactId: ArtifactId, aliases: ReadonlyArray<string>) => {
    const aliasStmt = this.db.prepare(`
      INSERT INTO
        artifact_aliases
      VALUES
        (artifact, slug)
    `);

    await this.db.batch(aliases.map((alias) => aliasStmt.bind(artifactId, alias)));
  };

  insertFiles = async (artifactId: ArtifactId, files: ReadonlyArray<ArtifactFile>) => {
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

    const fileRows = await this.db.batch<{ id: FileId }>(
      files.map((file) =>
        fileStmt.bind(
          artifactId,
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

    const aliasStmt = this.db.prepare(`
      INSERT INTO
        file_aliases (file, filename)
      VALUES
        (?1, ?2)
    `);

    await this.db.batch(
      files.flatMap((file) => file.aliases.map((alias, index) => aliasStmt.bind(fileIds[index], alias)))
    );
  };

  insertLinks = async (artifactId: ArtifactId, links: ReadonlyArray<ArtifactLink>) => {
    const stmt = this.db.prepare(`
      INSERT INTO
        links (artifact, name, url)
      VALUES
        (?1, ?2, ?3)
    `);

    await this.db.batch(links.map((link) => stmt.bind(artifactId, link.name, link.url)));
  };

  insertPeople = async (artifactId: ArtifactId, people: ReadonlyArray<string>) => {
    const stmt = this.db.prepare(`
      INSERT INTO
        people (artifact, name)
      VALUES
        (?1, ?2)
    `);

    await this.db.batch(people.map((name) => stmt.bind(artifactId, name)));
  };

  insertIdentities = async (artifactId: ArtifactId, identities: ReadonlyArray<string>) => {
    const stmt = this.db.prepare(`
      INSERT INTO
        identities (artifact, name)
      VALUES
        (?1, ?2)
    `);

    await this.db.batch(identities.map((name) => stmt.bind(artifactId, name)));
  };

  insertDecades = async (artifactId: ArtifactId, decades: ReadonlyArray<string>) => {
    const stmt = this.db.prepare(`
      INSERT INTO
        decades (artifact, decade)
      VALUES
        (?1, ?2)
    `);

    await this.db.batch(decades.map((decade) => stmt.bind(artifactId, decade)));
  };

  commitArtifact = async (artifactId: ArtifactId, key: string) => {
    await this.db
      .prepare(
        `
        INSERT INTO
          artifact_versions (key, version, artifact, created_at)
        VALUES (
          ?1,
          (
            SELECT
              IFNULL(MAX(version), 0) + 1
            FROM
              artifact_versions
            WHERE
              key = ?1
          ),
          ?2,
          unixepoch('now')
        )
      `
      )
      .bind(artifactId, key)
      .run();
  };
}

export const insertArtifact = async (d1: D1Database, artifact: Artifact) => {
  let db = new Database(d1);

  let artifactId = await db.insertArtifact(artifact);

  await db.insertArtifactAliases(artifactId, artifact.aliases);
  await db.insertFiles(artifactId, artifact.files);
  await db.insertLinks(artifactId, artifact.links);
  await db.insertPeople(artifactId, artifact.people);
  await db.insertIdentities(artifactId, artifact.identities);
  await db.insertDecades(artifactId, artifact.decades);
  await db.commitArtifact(artifactId, artifact.id);
};
