export interface ArtifactFile {
  name: string;
  filename: string;
  media_type?: string;
  multihash: string;
  lang?: string;
  hidden: boolean;
  aliases: Array<string>;
}

export interface ArtifactLink {
  name: string;
  url: string;
}

export interface Artifact {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description?: string;
  files: Array<ArtifactFile>;
  links: Array<ArtifactLink>;
  people: Array<string>;
  identities: Array<string>;
  from_year: number;
  to_year?: number;
  decades: Array<number>;
  collections: Array<string>;
  aliases: Array<string>;
}
