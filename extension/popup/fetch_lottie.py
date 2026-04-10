import urllib.request
import json
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
url = "https://api.github.com/search/code?q=detective+extension:json+size:>10000"
headers = {"User-Agent": "Mozilla/5.0"}
req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        for item in data.get('items', []):
            raw_url = item['html_url'].replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
            print("Trying", raw_url)
            try:
                anim = urllib.request.urlopen(raw_url).read().decode()
                if '"v":' in anim and '"layers":' in anim:
                    with open("detective.json", "w", encoding="utf-8") as f:
                        f.write(anim)
                    print("SUCCESS downloaded lottie to detective.json")
                    break
            except Exception as e:
                print("Failed to download", raw_url, e)
except Exception as e:
    print("Search failed", e)
