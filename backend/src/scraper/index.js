import { scrapeNews } from "./websiteScraper.js";
import { insertNews} from "../../db/db.js";
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

    console.log('Process Finished!');
    console.log("========================")

})();

