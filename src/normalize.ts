import { Artifact } from "./model";

export type NormalizedArtifact = Artifact;

// We normalize the names of identities and collections to all-lowercase so we don't have tags which
// differ only in capitalization. The Hugo site already does case normalization for us, but we need
// to do it at the database level for the REST API.
//
// It's not really necessary to preserve the original case information; The Hugo site "humanizes"
// the identity names by making the first letter uppercase. This will clobber some identity names,
// like "WTFromantic", but it's Good Enough.
//
// Note that we don't do this normalization for the names of people, because case is significant in
// a person's name. We can't assume anything about what names might look like, so we must preserve
// the original case information. Trying to "humanize" the name like we do with identity names is
// Not Good Enough.
//
// SQLite has a `COLLATE NOCASE` feature, but it only works for ASCII text. While the identity names
// are likely to be ASCII since this is an English-language site, we don't want to make that
// assumption.
export const normalizeArtifact = (artifact: Artifact): NormalizedArtifact => ({
  ...artifact,
  identities: artifact.identities.map((identity) => identity.toLowerCase()),
  collections: artifact.collections.map((collection) => collection.toLowerCase()),
});
