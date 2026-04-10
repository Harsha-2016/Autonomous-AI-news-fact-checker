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

  function playFootsteps(durationMs) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const stepInterval = 400; // ms per step
    const totalSteps = durationMs / stepInterval;
    
    for (let i = 0; i < totalSteps; i++) {
      setTimeout(() => {
        if (ctx.state === 'closed') return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        // Create a 'thump' sound
        osc.type = "sine";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime); // very subtle
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }, i * stepInterval);
    }
    return ctx;
  }

  scanBtn.addEventListener("click", async () => {
    // 1. Setup UI
    scanBtn.classList.add("hidden");
    resultView.classList.add("hidden");
    errorDiv.classList.add("hidden");

    // Grab new overlay elements
    const overlay = document.getElementById("animation-overlay");
    const animText = document.getElementById("animation-text");
    const lottieContainer = document.getElementById("lottie-container");
    const checkmark = document.getElementById("jump-checkmark");

    // Initialize overlay
    overlay.classList.remove("hidden");
    animText.classList.remove("opacity-0");
    checkmark.classList.add("hidden");
    
    // Clear and load lottie
    lottieContainer.innerHTML = "";
    lottieContainer.classList.remove("walking-animation");
    // Trigger reflow to restart animation reliably
    void lottieContainer.offsetWidth; 
    lottieContainer.classList.add("walking-animation");

    let animObj;
    try {
      animObj = lottie.loadAnimation({
        container: lottieContainer,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        // Loading animation directly from local disk avoids all network/S3/CORS issues dynamically!
        path: 'detective.json'
      });
    } catch (e) {
      console.warn("Lottie failed to load, falling back to text only.", e);
      lottieContainer.innerHTML = "<span style='font-size:75px;'>🕵️‍♂️</span>";
    }

    // Play footstep sounds for 8 seconds
    const audioCtx = playFootsteps(8000);

    // 2. Fetch Backend in Parallel
    let backendData = null;
    let fetchError = null;

    const performFetch = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error("Could not find the active tab.");

        try {
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
        } catch (e) { console.log("Script injection skipped:", e); }

        return new Promise((resolve) => {
          chrome.tabs.sendMessage(tab.id, { action: "extract_article" }, async (response) => {
            if (chrome.runtime.lastError || !response || (!response.text && !response.url)) {
              fetchError = "Cannot scan this page or no content found.";
              return resolve();
            }

            const claimText = (response.text && response.text.length > 100) ? response.text : response.url;
            try {
              const apiRes = await fetch("http://127.0.0.1:8000/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ claim: claimText })
              });
              if (!apiRes.ok) throw new Error(`Server error: ${apiRes.status}`);
              backendData = await apiRes.json();
            } catch (err) {
              fetchError = "Failed to reach the TruthLens backend.";
            }
            resolve();
          });
        });
      } catch (err) {
        fetchError = err.message;
      }
    };

    // Start background fetch returning a promise
    const fetchPromise = performFetch();

    // Ensure at least 8 seconds pass for the visualization
    const timerPromise = new Promise(resolve => setTimeout(resolve, 8000));

    // 3. Complete animation exactly when BOTH 8 seconds and backend fetch are finished
    Promise.all([fetchPromise, timerPromise]).then(() => {
      audioCtx.close();
      checkmark.classList.remove("hidden");
      
      // Give the checkmark 1 second to show
      setTimeout(() => {
        overlay.classList.add("hidden");
        animText.classList.add("opacity-0");
        lottieContainer.classList.remove("walking-animation");
        if (animObj) animObj.destroy(); // cleanup
        
        // Show actual results
        if (fetchError) {
          showError(fetchError);
        } else if (backendData) {
          showResult(backendData);
        } else {
          showError("Analysis failed unexpectedly.");
        }
      }, 1000);
    });
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
