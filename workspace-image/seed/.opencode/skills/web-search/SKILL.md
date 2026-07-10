---
name: web-search
description: Search the web for current information, news, or general knowledge using SearXNG. Returns top search results with titles, URLs, and snippets. Run this before fetching specific web pages.
---

# Web Search

Use this skill to search the web for up-to-date information, news, code documentation, or facts.

Run the helper search script via the Bash tool:

```bash
python3 .opencode/skills/web-search/search.py "<SEARCH_QUERY>"
```

### Guidelines for Agents:
1. Replace `<SEARCH_QUERY>` with a clean, keyword-focused search query.
2. From the list of returned search results, identify the most relevant URLs.
3. For deep reading of individual web pages, fetch their full text content using Jina Reader (part of the `web-reach` skill):
   ```bash
   curl -s https://r.jina.ai/<URL>
   ```
4. Always summarize the findings clearly and cite the source URLs you used.
