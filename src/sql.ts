import { Artifact, ArtifactFile, ArtifactLink } from "./model";

type ArtifactId = number;
type FileId = number;

type ArtifactData = Pick<Artifact, "slug" | "title" | "summary" | "description" | "from_year" | "to_year">;

type FileWithId = ArtifactFile & { id: FileId };

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

  insertFiles = async (
    artifactId: ArtifactId,
    files: ReadonlyArray<ArtifactFile>
  ): Promise<ReadonlyArray<FileWithId>> => {
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

    return files.map((file, index) => ({
      id: fileIds[index],
      ...file,
    }));
  };

  prepareArtifactAliases = (
    artifactId: ArtifactId,
    aliases: ReadonlyArray<string>
  ): ReadonlyArray<D1PreparedStatement> => {
    const aliasStmt = this.db.prepare(`
      INSERT INTO
        artifact_aliases
      VALUES
        (artifact, slug)
    `);

    return aliases.map((alias) => aliasStmt.bind(artifactId, alias));
  };

  prepareFileAliases = (
    files: ReadonlyArray<Pick<FileWithId, "id" | "aliases">>
  ): ReadonlyArray<D1PreparedStatement> => {
    const aliasStmt = this.db.prepare(`
      INSERT INTO
        file_aliases (file, filename)
      VALUES
        (?1, ?2)
    `);

    return files.flatMap((file) => file.aliases.map((alias) => aliasStmt.bind(file.id, alias)));
  };

  prepareLinks = (artifactId: ArtifactId, links: ReadonlyArray<ArtifactLink>): ReadonlyArray<D1PreparedStatement> => {
    const stmt = this.db.prepare(`
      INSERT INTO
        links (artifact, name, url)
      VALUES
        (?1, ?2, ?3)
    `);

    return links.map((link) => stmt.bind(artifactId, link.name, link.url));
  };

  preparePeople = (artifactId: ArtifactId, people: ReadonlyArray<string>): ReadonlyArray<D1PreparedStatement> => {
    const stmt = this.db.prepare(`
      INSERT INTO
        people (artifact, name)
      VALUES
        (?1, ?2)
    `);

    return people.map((name) => stmt.bind(artifactId, name));
  };

  prepareIdentities = (
    artifactId: ArtifactId,
    identities: ReadonlyArray<string>
  ): ReadonlyArray<D1PreparedStatement> => {
    const stmt = this.db.prepare(`
      INSERT INTO
        identities (artifact, name)
      VALUES
        (?1, ?2)
    `);

    return identities.map((name) => stmt.bind(artifactId, name));
  };

  prepareDecades = (artifactId: ArtifactId, decades: ReadonlyArray<string>): ReadonlyArray<D1PreparedStatement> => {
    const stmt = this.db.prepare(`
      INSERT INTO
        decades (artifact, decade)
      VALUES
        (?1, ?2)
    `);

    return decades.map((decade) => stmt.bind(artifactId, decade));
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
  let files = await db.insertFiles(artifactId, artifact.files);

  await d1.batch([
    ...db.prepareArtifactAliases(artifactId, artifact.aliases),
    ...db.prepareFileAliases(files),
    ...db.prepareLinks(artifactId, artifact.links),
    ...db.preparePeople(artifactId, artifact.people),
    ...db.prepareIdentities(artifactId, artifact.identities),
    ...db.prepareDecades(artifactId, artifact.decades),
  ]);

  db.commitArtifact(artifactId, artifact.id);
};
