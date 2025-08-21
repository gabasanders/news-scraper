import { scrapeNews } from "./websiteScraper.js";
import { insertNews, updateSummary, getArticlesNeedingSummary} from "../../db/db.js";
import data from '../../websites.json' with { type: 'json' };
import { REGION_KEYWORDS } from "./constants.js";

function verifyKeywords(keywords,content){

    const lowerText = content.toLowerCase();

    const check = keywords.every(word => lowerText.includes(word.toLowerCase()));

    if (check){
        return true
    }
    else{
        return false
    }
}

function makeReqId(prefix = "ng") {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const HH = pad(now.getHours());
  const MM = pad(now.getMinutes());
  const SS = pad(now.getSeconds());
  const suffix = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
  return `${prefix}_${yyyy}${mm}${dd}_${HH}${MM}${SS}_${suffix}`.replace(/^ng_20/, "ng_");
}

function buildApiPayload(parts, {
  req_source = "news_graber",
  system_prompt = "you are the world best analyst of news analyst about cars",
  user_prompt = "give me a summary for no more than 50 words about this content of news",
} = {}) {
  return {
    req_id: makeReqId("ng"),
    req_source,
    req_overall_system_prompt: system_prompt,
    req_overall_user_prompt: user_prompt,
    req_body: {
      type: "text_only",
      parts
    }
  };
}

async function callSummarizationAPI(payload) {
  const {
    SUMMARY_API_URL = "http://localhost:8000/summarize",
    SUMMARY_API_KEY = "",
    SUMMARY_TIMEOUT_MS = "45000"
  } = process.env;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(SUMMARY_TIMEOUT_MS));

  try {
    const res = await fetch(SUMMARY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SUMMARY_API_KEY ? { "Authorization": `Bearer ${SUMMARY_API_KEY}` } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Summarization API error: ${res.status} ${text}`);
    }

    const data = await res.json();

    // data.response_body.parts: [{ req_id, req_lang, response_content }, ...]
    const out = new Map();
    const parts = data?.response_body?.parts ?? [];
    for (const p of parts) {
      const id = p.req_id || p.id; // tolera variações
      const content = p.response_content;
      if (id && typeof content === "string") {
        out.set(id, content.trim());
      }
    }
    return out;
  } finally {
    clearTimeout(timeout);
  }
}

(async () => {

    const keywords = REGION_KEYWORDS;
    
    console.log("========================")
    console.log("Initializing Scraping...");
    const allNews = await scrapeNews();

    console.log("Scraping Finished!")
    console.log(`Count of Scraped News: ${allNews.lenght}`);
    console.log("========================")


    console.log("========================")
    console.log("Preparing to save news in the database...");

    for (const sourceKey in allNews) { 
        const sourceData = allNews[sourceKey];

        for (const newsTypeKey in sourceData) { 
            const newsTypeData = sourceData[newsTypeKey];

            for (const newsKey in newsTypeData) {
                const newsArticle = newsTypeData[newsKey];

                var found_keywords = [];

                const region = data[newsArticle.source].region;

                for (const keyword of keywords[region]){

                    if (verifyKeywords(keyword, newsArticle.content) == true){
                        found_keywords.push.apply(found_keywords, keyword); // Add keywords to the list without creating a list nested in another list
                        
                        console.log(`Found Keywords for ${newsArticle.title}:`);
                        console.log(found_keywords);

                    }
                }

                if (found_keywords.length > 0){

                    newsArticle.keywords = [... new Set(found_keywords)];
                    
                    console.log(`Saving ${newsArticle} to the database...`)
                    console.log("Saving the following newsArticle to the database:");
                    console.log(JSON.stringify(newsArticle, null, 2));


                    await insertNews(newsArticle);
                    
                }
                else{
                    console.log(`No keywords found in ${newsArticle.link}`)
                }

            }
        }
    }

    console.log("========================");
    console.log("Requesting Summaries for the saved news articles...");

    
    // Busca artigos que têm conteúdo e ainda não possuem summary
    const pending = await getArticlesNeedingSummary(200); // ajuste o limite

    console.log(`Found ${pending.length} articles needing summary.`);

    // Processa em lotes para não sobrecarregar a API
    const BATCH_SIZE = 20;

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);

    // Monta parts no formato exigido
    // e mapeia p_id -> url para atualizar o banco na volta
    const idToUrl = new Map();

    const parts = batch.map((item, idx) => {
        const partId = `p_${idx + 1}`;
        idToUrl.set(partId, item.url);

        return {
        id: partId,
        lang: "pt",
        content: item.news_content,
        source: item.source ?? "",              // opt
        notes: item.title ? String(item.title) : "" // opt
        };
    });

    const payload = buildApiPayload(parts, {
        req_source: "news_graber",
        system_prompt: "you are the world best analyst of news analyst about cars",
        user_prompt: "give me a summary for no more than 50 words about this content of news"
    });
    
    console.log('Sending payload:', JSON.stringify(payload, null, 2));

    try {
        const mapIdToSummary = await callSummarizationAPI(payload);

        for (const [partId, summary] of mapIdToSummary.entries()) {
        const url = idToUrl.get(partId);
        if (!url) {
            console.warn(`Received summary for unknown partId=${partId}; skipping`);
            continue;
        }
        try {
            await updateSummaryByUrl(url, summary);
            console.log(`Summary saved for: ${url}`);
        } catch (err) {
            console.error(`Failed to update DB for ${url}:`, err.message);
        }
        }
    } catch (err) {
        console.error("Batch summarization failed:", err.message);
    }
    }

    console.log("All done.");

})();



