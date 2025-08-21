// src/constants.js

// API endpoints
export const API_URL = "http://localhost:3002/api/news";

// Regions & keyword mappings
export const REGION_KEYWORDS = {
  BR: [["BYD"], ["BYD", "China"]],
  US: [["BYD", "China"], ["BYD", "Brasil"]],
  CH: [["BYD", "China"], ["BYD", "Brasil"]],
};

// UI constants
export const MAX_RESULTS = 50;

// List of websites to skip during scraping
export const SKIP_LIST = ['autohome'];
