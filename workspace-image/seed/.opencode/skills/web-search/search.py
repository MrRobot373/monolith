import os
import sys
import urllib.request
import urllib.parse
import json
from html.parser import HTMLParser

# Reconfigure stdout to use UTF-8 to prevent encoding crashes on Windows/CMD
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

class DDGLiteParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.results = []
        self.current_result = None
        self.in_result_snippet = False
        self.in_result_title = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'td' and attrs_dict.get('class') == 'result-snippet':
            self.in_result_snippet = True
        elif tag == 'a' and attrs_dict.get('class') == 'result-link':
            self.in_result_title = True
            href = attrs_dict.get('href', '')
            # Clean up the DuckDuckGo redirect link
            if href.startswith('//duckduckgo.com/l/?uddg='):
                parsed = urllib.parse.urlparse(href)
                queries = urllib.parse.parse_qs(parsed.query)
                href = queries.get('uddg', [href])[0]
            elif href.startswith('/l/?uddg='):
                parsed = urllib.parse.urlparse(href)
                queries = urllib.parse.parse_qs(parsed.query)
                href = queries.get('uddg', [href])[0]
            self.current_result = {'title': '', 'url': href, 'content': ''}

    def handle_endtag(self, tag):
        if tag == 'td' and self.in_result_snippet:
            self.in_result_snippet = False
            if self.current_result:
                self.results.append(self.current_result)
                self.current_result = None
        elif tag == 'a' and self.in_result_title:
            self.in_result_title = False

    def handle_data(self, data):
        if self.in_result_title and self.current_result:
            self.current_result['title'] += data
        elif self.in_result_snippet and self.current_result:
            self.current_result['content'] += data

def search_searxng(query, endpoint):
    encoded_query = urllib.parse.quote(query)
    url = f"{endpoint}/search?q={encoded_query}&format=json"
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
    )
    with urllib.request.urlopen(req, timeout=5) as response:
        if response.status == 200:
            parsed = json.loads(response.read().decode('utf-8'))
            results = parsed.get('results', [])
            if results:
                return [{'title': r.get('title',''), 'url': r.get('url',''), 'content': r.get('content','')} for r in results]
    return []

def search_ddg_lite(query):
    encoded = urllib.parse.urlencode({'q': query})
    url = "https://lite.duckduckgo.com/lite/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    req = urllib.request.Request(url, data=encoded.encode('utf-8'), headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=8) as response:
        html = response.read().decode('utf-8')
        parser = DDGLiteParser()
        parser.feed(html)
        return parser.results

def main():
    if len(sys.argv) < 2:
        print("Usage: python search.py <query>")
        sys.exit(1)

    query = " ".join(sys.argv[1:])
    results = []

    # 1. Try a self-hosted SearXNG named by SEARXNG_URL (same knob the
    #    monolith-web MCP uses; the stack no longer ships a SearXNG service).
    endpoint = os.environ.get("SEARXNG_URL", "").strip().rstrip("/")
    if endpoint:
        try:
            results = search_searxng(query, endpoint)
        except Exception:
            pass

    # 2. Try Localhost SearXNG (if running natively but with local SearXNG)
    if not results:
        try:
            results = search_searxng(query, "http://127.0.0.1:8080")
        except Exception:
            pass

    # 3. Fallback: Scrape DuckDuckGo Lite (no API keys, zero-dependency, works everywhere)
    if not results:
        try:
            results = search_ddg_lite(query)
        except Exception as e:
            print(f"Error: All search endpoints failed. DuckDuckGo error: {e}")
            sys.exit(1)

    if not results:
        print("No results found.")
        sys.exit(0)

    for i, r in enumerate(results[:10], 1):
        title = r.get('title', 'No Title').strip()
        url = r.get('url', '')
        content = r.get('content', 'No description available.').strip()
        print(f"[{i}] {title}\nURL: {url}\nSnippet: {content}\n---")

if __name__ == '__main__':
    main()
