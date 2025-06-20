-- Migration number: 0004 	 2025-06-20T10:29:56.330Z
ALTER TABLE "files"
ADD COLUMN "pos" integer NOT NULL DEFAULT 0;

CREATE TRIGGER set_file_pos_on_insert
    AFTER INSERT ON files
    FOR EACH ROW
BEGIN
  UPDATE files
  SET pos = COALESCE(
      (SELECT MAX(pos)
       FROM files
       WHERE artifact = NEW.artifact
       AND id != NEW.id),
      -1
  ) + 1
  WHERE id = NEW.id;
END;

ALTER TABLE "links"
ADD COLUMN "pos" integer NOT NULL DEFAULT 0;

CREATE TRIGGER set_link_pos_on_insert
    AFTER INSERT ON links
    FOR EACH ROW
BEGIN
  UPDATE links
  SET pos = COALESCE(
      (SELECT MAX(pos)
       FROM links
       WHERE artifact = NEW.artifact
       AND id != NEW.id),
      -1
  ) + 1
  WHERE id = NEW.id;
END;

