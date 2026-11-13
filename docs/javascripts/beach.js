/* Optional homepage ambience. No media source is attached until it is needed. */
(function () {
  "use strict";
  const hero = document.querySelector("[data-beach-hero]");
  if (!hero) return;
  const video = hero.querySelector("video");
  const audio = hero.querySelector("audio");
  const motionButton = hero.querySelector(".hero__motion");
  const soundButton = hero.querySelector(".hero__sound");
  const status = hero.querySelector(".hero__status");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const connection = navigator.connection;
  const constrained = () => reducedMotion.matches || Boolean(connection &&
    (connection.saveData || /(^|-)2g$/.test(connection.effectiveType)));
  let motionWanted = !constrained();
  let soundWanted = false;
  let inView = false;
  let leaving = false;
  let videoPending = false;
  let audioPending = false;
  video.muted = true;
  audio.volume = 0.45;
  hero.querySelector(".hero__toolbar").hidden = false;

  function active() { return inView && !document.hidden && !leaving; }
  function labels() {
    motionButton.textContent = motionWanted ? "Pause waves" : "Play waves";
    motionButton.setAttribute("aria-pressed", String(motionWanted));
    soundButton.textContent = soundWanted ? "Sound on" : "Sound off";
    soundButton.setAttribute("aria-pressed", String(soundWanted));
    soundButton.setAttribute("aria-label", soundWanted ? "Turn off ocean sounds" : "Turn on ocean sounds");
  }
  function sync() {
    if (active() && motionWanted) {
      if (!video.hasAttribute("src")) {
        // Select once: resizing does not trigger a second video download.
        video.src = window.matchMedia("(max-width: 767px)").matches
          ? video.dataset.mobileSrc : video.dataset.desktopSrc;
      }
      if (video.paused && !videoPending) {
        videoPending = true;
        video.play().catch(function (error) {
          if (error.name !== "AbortError" && active() && motionWanted) {
            motionWanted = false;
            status.textContent = "Tap Play waves to start the beach.";
          }
        }).finally(function () {
          videoPending = false;
          if (!active() || !motionWanted) video.pause();
          labels();
        });
      }
    } else video.pause();

    if (active() && soundWanted) {
      if (!audio.hasAttribute("src")) audio.src = audio.dataset.src;
      if (audio.paused && !audioPending) {
        audioPending = true;
        audio.play().catch(function (error) {
          if (error.name !== "AbortError" && active() && soundWanted) {
            soundWanted = false;
            status.textContent = "Sound could not start. Tap Sound off to retry.";
          }
        }).finally(function () {
          audioPending = false;
          if (!active() || !soundWanted) audio.pause();
          labels();
        });
      }
    } else audio.pause();
    labels();
  }
  video.addEventListener("playing", function () { video.classList.add("is-ready"); });
  video.addEventListener("error", function () {
    motionWanted = false;
    video.classList.remove("is-ready");
    motionButton.disabled = true;
    status.textContent = "Showing a still beach. Video is unavailable.";
    labels();
  });
  audio.addEventListener("error", function () {
    soundWanted = false;
    soundButton.disabled = true;
    status.textContent = "Ocean sounds are unavailable.";
    labels();
  });
  motionButton.addEventListener("click", function () {
    motionWanted = !motionWanted;
    status.textContent = "";
    sync();
  });
  soundButton.addEventListener("click", function () {
    soundWanted = !soundWanted;
    status.textContent = "";
    sync();
  });
  function respectPreferences() {
    if (constrained()) motionWanted = false;
    sync();
  }
  reducedMotion.addEventListener("change", respectPreferences);
  if (connection) connection.addEventListener("change", respectPreferences);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", function () { leaving = true; sync(); });
  window.addEventListener("pageshow", function () { leaving = false; sync(); });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.05;
      sync();
    }, { threshold: [0, 0.05] });
    observer.observe(hero);
  } else {
    // Older browsers keep the still cover until explicit interaction.
    motionWanted = false;
    inView = true;
  }
  labels();
})();
