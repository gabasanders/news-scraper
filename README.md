# News Scraper

A JavaScript-based scraper and aggregator that collects news from multiple sources,  
filters them by **keywords**, and displays the most relevant articles to the user.

## Features

- Scrapes multiple online news sources
- Keyword-based filtering system
- Outputs structured results for easy consumption
- Backend + Frontend separation
- PostgreSQL database integration

---

## How it works

1. The **scraper** collects raw news articles from configured sources.
2. Articles are **filtered by keywords** before being stored.
3. The **frontend** displays the filtered news to the user, showing the keywords contained in that article.

---

## How to configure it

### Set the website HTML structure

Each website has it's unique structure, and in order to to scrape it, you will need to first comprehend it. We will need informations for each website, just like the following example:

```json
    "g1": {
        "url": "https://g1.globo.com/carros/",
        "region": "BR",
        "pubDate" : ["meta[itemprop='datePublished']","content"],
        "textContent" : ".mc-article-body p",
        "source" : "g1",
        "news_structure": [{
            "container": ".feed-post-body",
            "header": "._evt p",
            "desc": ".feed-post-body-resumo p",
            "link": "._evt a"
        }]
    }
```

_pubDate_, _textContent_ and everything under _news_structure_ is related to the HTML structure of each specific website. [This video](https://www.youtube.com/watch?v=q-kbzWjyPak) can guide you on how to identify the correct structure.
