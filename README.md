# submission-worker

This repo is a [Cloudflare Worker](https://developers.cloudflare.com/workers/) for adding artifact
metadata to the database.

This worker accepts `POST` requests containing the artifact metadata JSON to this endpoint:

```
https://submit.acearchive.lgbt/submit
```

This worker is called by
[artifact-submit-action](https://github.com/acearchive/artifact-submit-action) to upload new
artifact metadata and stores the metadata in a [D1](https://developers.cloudflare.com/d1) SQLite
database.
