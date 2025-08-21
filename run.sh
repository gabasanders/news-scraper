#!/bin/bash

echo "Setting up the environment..."
(cd backend && node server.js) &
(cd news_page && npm run dev) &

sleep 10

echo Scraping news articles...
(cd backend/src/scraper && node index.js)
