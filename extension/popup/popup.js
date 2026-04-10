/**
 * Popup script for TruthLens Chrome Extension
 */

document.addEventListener("DOMContentLoaded", () => {
  const scanBtn = document.getElementById("scan-btn");
  const loadingDiv = document.getElementById("loading");
  const errorDiv = document.getElementById("error");
  const resultView = document.getElementById("result-view");
  const gaugeFill = document.getElementById("gauge-fill");
  const scoreVal = document.getElementById("score-val");
  const verdictVal = document.getElementById("verdict-val");
  const summaryText = document.getElementById("summary");
  const confVal = document.getElementById("conf-val");
  const covVal = document.getElementById("cov-val");

  scanBtn.addEventListener("click", async () => {
    // 1. Setup UI
    scanBtn.classList.add("hidden");
    resultView.classList.add("hidden");
    errorDiv.classList.add("hidden");
    loadingDiv.classList.remove("hidden");

    try {
      // 2. Query active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error("Could not find the active tab.");

      // 3. Inject content script if not already injected (safeguard)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"]
        });
      } catch (e) {
        // May fail if already injected or on browser internal pages
        console.log("Script injection skipped or failed:", e);
      }

      // 4. Request text from content script
      chrome.tabs.sendMessage(tab.id, { action: "extract_article" }, async (response) => {
        if (chrome.runtime.lastError) {
          showError("Cannot scan this page. Try refreshing the page, or ensure it is a valid website.");
          return;
        }

        if (!response || (!response.text && !response.url)) {
          showError("No content to analyze.");
          return;
        }

        const claimText = (response.text && response.text.length > 100) ? response.text : response.url;

        // 5. Hit backend
        try {
          const apiRes = await fetch("http://127.0.0.1:8000/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ claim: claimText })
          });

          if (!apiRes.ok) {
            throw new Error(`Server error: ${apiRes.status}`);
          }

          const data = await apiRes.json();
          showResult(data);
        } catch (apiErr) {
          console.error(apiErr);
          showError("Failed to reach the TruthLens backend. Make sure the local server is running on port 8000.");
        }
      });
    } catch (err) {
      console.error(err);
      showError(err.message);
    }
  });

  function showError(msg) {
    loadingDiv.classList.add("hidden");
    scanBtn.classList.remove("hidden");
    scanBtn.innerText = "Try Again";
    
    errorDiv.innerText = msg;
    errorDiv.classList.remove("hidden");
  }

  function showResult(data) {
    loadingDiv.classList.add("hidden");
    
    // Setup reset ability
    scanBtn.classList.remove("hidden");
    scanBtn.innerText = "Scan Another Page";
    
    resultView.classList.remove("hidden");

    // Bind basic data
    const score = Number(data.truth_score) || 0;
    scoreVal.innerText = score.toFixed(1);
    summaryText.innerText = data.summary || "No summary available.";
    
    // Bind components
    const sc = data.score_components || {};
    confVal.innerText = sc.confidence ? Number(sc.confidence).toFixed(0) : 0;
    covVal.innerText = sc.coverage ? Number(sc.coverage).toFixed(0) : 0;

    // Verdict styling mapping
    let color = "#10b981"; // Emerald
    const verdictUpper = (data.verdict || "Uncertain").toUpperCase();
    if (verdictUpper === "FALSE") {
      color = "#f43f5e"; // Rose
    } else if (verdictUpper === "UNCERTAIN") {
      color = "#fbbf24"; // Amber
    }

    verdictVal.innerText = verdictUpper;
    verdictVal.style.color = color;

    // Update SVG gauge
    // Circumference for r=40 is ~251.2, but semicircle is 125.6
    // Formula: 125.6 - (score/100 * 125.6)
    const offset = 125.6 - ((score / 100) * 125.6);
    
    // Small delay to allow CSS transition to play after unhide
    setTimeout(() => {
      gaugeFill.style.strokeDashoffset = offset.toString();
      gaugeFill.style.stroke = color;
    }, 50);
  }
});
