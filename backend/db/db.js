import pg from "pg";
import { parse } from "date-fns";

const {
  PGHOST = "localhost",
  PGPORT = "5432",
  PGUSER = "myuser",
  PGPASSWORD = "mypassword",
  PGDATABASE = "newsdb",
  PGDEFAULTDB = "postgres",
} = process.env;

function targetConfig() {
  return {
    host: String(PGHOST),
    port: Number(PGPORT),
    user: String(PGUSER),
    password: String(PGPASSWORD),
    database: String(PGDATABASE),
  };
}

function adminConfig() {
  return {
    host: String(PGHOST),
    port: Number(PGPORT),
    user: String(PGUSER),  
    password: String(PGPASSWORD),
    database: String('postgres'),  // <-- postgres/template1
    connectionTimeoutMillis: 5000
  };
}

let pool = null;

// Verify if the target database exists, if not create it
async function ensureDatabase() {
  const admin = new pg.Client(adminConfig());
  await admin.connect();

  try {
    const { rows } = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [PGDATABASE]
    );
    if (rows.length === 0) {
      await admin.query(`CREATE DATABASE "${PGDATABASE}" OWNER "${PGUSER}"`);
    }
  } finally {
    await admin.end();
  }
}

async function getPool() {
  if (!pool) {
    await ensureDatabase();            
    pool = new pg.Pool(targetConfig()); 
  }
  return pool;
}

async function ensureSchema() {
  const _pool = await getPool();       
  const client = await _pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS news_articles (
        id             BIGSERIAL PRIMARY KEY,
        title          TEXT NOT NULL,
        url            TEXT NOT NULL,
        news_content   TEXT,
        pub_date       DATE,
        source         TEXT,
        news_desc      TEXT,
        summary        TEXT,
        keywords       JSONB DEFAULT '[]',
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_news_articles_url'
        ) THEN
          ALTER TABLE news_articles
          ADD CONSTRAINT uq_news_articles_url UNIQUE (url);
        END IF;
      END$$;
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'news_articles_set_updated_at'
        ) THEN
          CREATE TRIGGER news_articles_set_updated_at
          BEFORE UPDATE ON news_articles
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END IF;
      END$$;
    `);
  } finally {
    client.release();
  }
}

function correctDate(rawDate, source) {
  let year, month, day;

  if (source === "autohome") {
    const dateObj = parse(rawDate, "yyyy年MM月dd日 HH:mm", new Date());
    year = dateObj.getFullYear();
    month = String(dateObj.getMonth() + 1).padStart(2, "0");
    day = String(dateObj.getDate()).padStart(2, "0");
  } else {
    const dateObj = new Date(rawDate);
    year = dateObj.getFullYear();
    month = String(dateObj.getMonth() + 1).padStart(2, "0");
    day = String(dateObj.getDate()).padStart(2, "0");
  }

  return `${year}-${month}-${day}`;
}

export async function insertNews(newsItem) {
  await ensureSchema();

  const formattedDate = correctDate(newsItem.pubDate, newsItem.source);

  const text = `
    INSERT INTO news_articles
      (title, url, news_content, pub_date, source, news_desc, summary,keywords)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
    ON CONFLICT (url) DO NOTHING
    RETURNING id;
  `;

  const values = [
    newsItem.title,
    newsItem.link,
    newsItem.content,
    formattedDate,
    newsItem.source,
    newsItem.sumDesc,
    newsItem.summary,
    JSON.stringify(newsItem.keywords ?? []),
  ];

  try {
    const res = await pool.query(text, values);
    return res.rows[0]?.id ?? null;
  } catch (error) {
    console.error("Error inserting article:", error);
    throw error;
  }
}

export async function getNews() {
    console.log("Fetching all news articles from the database...");
  await ensureSchema();
    const res = await pool.query(`
    SELECT id, title, source, pub_date, url, news_desc, keywords
    FROM news_articles
    ORDER BY id DESC
  `);

  return res.rows;
}

export async function getArticlesNeedingSummary(limit = 200) {
  await ensureSchema();
  const _pool = await getPool();

  const { rows } = await _pool.query(
    `
    SELECT url, news_content, source, title
    FROM news_articles
    WHERE 
      news_content IS NOT NULL 
      AND news_content <> '' 
      AND (summary IS NULL OR summary = '')
    ORDER BY updated_at ASC
    LIMIT $1
    `,
    [limit]
  );

  return rows;
}

export async function updateSummary(url, summary) {
  await ensureSchema();
  const _pool = await getPool();

  const { rowCount } = await _pool.query(
    `
    UPDATE news_articles
    SET summary = $2, updated_at = NOW()
    WHERE url = $1
    `,
    [url, summary]
  );

  return rowCount > 0;
}