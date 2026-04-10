import requests
import re
import json

url = "https://lottiefiles.com/free-animation/detective-search-wFn55jh3nt"
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36"}
try:
    html = requests.get(url, headers=headers).text
    
    # Let's search all urls ending with json
    urls = re.findall(r'https://[^"\'\s]+\.json', html)
    print("Found urls:", list(set(urls)))
    
    with open("page.html", "w", encoding="utf-8") as f:
        f.write(html)
        
except Exception as e:
    print("Error:", e)
