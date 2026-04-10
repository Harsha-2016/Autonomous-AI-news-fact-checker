// content.js
// Listens for messages from the popup to extract article text

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract_article") {
    let text = "";
    
    // Attempt to extract from semantic HTML5 elements first
    const articleNode = document.querySelector("article");
    if (articleNode) {
      text = articleNode.innerText;
    } else {
      // Fallback: get all visible text in body
      // We clone the body to remove scripts and styles from text extraction
      const bodyClone = document.body.cloneNode(true);
      const scripts = bodyClone.querySelectorAll('script, style, noscript, nav, header, footer');
      scripts.forEach(el => el.remove());
      text = bodyClone.innerText;
    }
    
    // Clean up excessive whitespace
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    
    sendResponse({ text: text, url: window.location.href });
  }
  return true;
});
