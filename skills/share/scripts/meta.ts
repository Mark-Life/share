/** Written by the CLI as `<prefix>/_meta.json`; marks a prefix as one share. */
export interface ShareMeta {
  title: string;
  /** File the share URL opens: `index.html` for sites, the file itself otherwise. */
  entry: string;
  source: string;
  host: string;
  createdAt: string;
  updatedAt: string;
}

export const META_FILE = "_meta.json";

/** Namespace that the bucket lifecycle rule empties after 30 days. */
export const JUNK_NS = "junk";
