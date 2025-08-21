import { chromium } from 'playwright'; 
import data from '../../websites.json' with { type: 'json' };
import { getNews } from '../../db/db.js';
import { SKIP_LIST } from './constants.js';

const reset = '\x1b[0m';
const red   = '\x1b[31m';
const green = '\x1b[32m';
const blue  = '\x1b[34m';

async function scrapeNews() {

    const browser = await chromium.launch();
    const page = await browser.newPage();
    const allNews = {};

    // Get the list of all the links present in the database
    const oldList = await getNews().then(data => data.map(obj => obj.url));

    const SkipWebSiteList = SKIP_LIST;

    // for each website in websites.json
    for (const site in data){

        if (SkipWebSiteList.includes(data[site].source)){
            console.log(blue, `Skiping ${data[site].source}...`,reset)
            continue;
        }

        const websiteConfig = data[site];

        allNews[site] = {}

        console.log(blue, `Connecting to ${websiteConfig.url}`,reset)
        await page.goto(websiteConfig.url, {
            timeout: 60000,
            waitUntil: "domcontentloaded"
        });

        console.log("Connected!");

        //for each news_type in the website
        for (const newsType in websiteConfig.news_structure){

            // get the dict of selectors
            const newsTypeConfig = websiteConfig.news_structure[newsType];

            // get each key of the dict
            const {container, header, desc, link} = newsTypeConfig;

            //get every news card (title, description and link) in the News Homepage
            const newsSummary = await page.$$eval(container, (elements, {header, desc, link}) => {
                return elements.slice(0,15).map(
                    el => {
                        const newsTitle = el.querySelector(header)?.innerText || "No title";
                        const newsDesc = el.querySelector(desc)?.innerText || "No desc";
                        const newsLink = link === "Within"
                            ? el.href || "No link"
                            : el.querySelector(link)?.href || "No link";


                        if (newsTitle === "No title" || newsLink === "No link"){
                            return null
                        }

                        return { newsTitle, newsDesc, newsLink };
                    }
                ).filter(item => item !== null);
            }, {header,desc,link});

            const newsDetails = [];

            //for each card collected above, get the date and content
            for (const newsSum of newsSummary){

                console.log(newsSum.newsLink)

                if (oldList.includes(newsSum.newsLink)){
                    console.log(red, `Already collected: ${newsSum.newsLink}`,reset)
                }
                else{
                    //go to the news page
                    // console.log(`Acessing: ${newsSum.newsLink}`)
                    // console.log(`Title: ${newsSum.newsTitle}`)
                    // console.log(`Desc: ${newsSum.newsDesc}`)
                    await page.goto(newsSum.newsLink,{
                        waitUntil: "domcontentloaded",
                        timeout: 45000
                    })

                    //await page.waitForSelector(websiteConfig.pubDate[0], { timeout: 10000 });
                    
                    const date_container = websiteConfig.pubDate[0];
                    const date_attr = websiteConfig.pubDate[1];
                    
                    let pubDate;

                    if (date_attr === "None"){
                        pubDate = await page.$eval(date_container, el => el.textContent.trim());
                    }
                    else{
                        pubDate = await page.$eval(date_container, (el, date_attr) => el.getAttribute(date_attr) , date_attr);
                    }

                    console.log(pubDate);
    
                    const textContent = await page.$$eval(websiteConfig.textContent,elements => {
                        return elements.map(el => el.innerText.trim()).join('\n').trim();
                    });
    
                    //push every collected info
                    newsDetails.push({
                        title :newsSum.newsTitle,
                        sumDesc: newsSum.newsDesc,
                        link: newsSum.newsLink,
                        pubDate: pubDate,
                        content: textContent,
                        source: websiteConfig.source,
                        summary: null
                    });
                }


            }

            allNews[site][newsType] = newsDetails;

            //go back to the main news page
            await page.goto(websiteConfig.url,{
                waitUntil: "domcontentloaded",
                timeout: 45000
            })

        }

        console.log(green,`Website ${site} Successfully Scraped!`,reset)
    }

    await browser.close();

    return allNews;
}

export {scrapeNews};
