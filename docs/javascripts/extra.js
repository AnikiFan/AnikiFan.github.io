(function () {
  function currentScheme() {
    return document.body.getAttribute("data-md-color-scheme") || "default";
  }

  function giscusTheme(scheme) {
    return scheme === "slate" ? "dark" : "light";
  }

  function setGiscusTheme(scheme) {
    const theme = giscusTheme(scheme);
    const frame = document.querySelector("iframe.giscus-frame");
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage(
        { giscus: { setConfig: { theme } } },
        "https://giscus.app"
      );
      return;
    }
    const script = document.querySelector("script[src*='giscus.app']");
    if (script) {
      script.setAttribute("data-theme", theme);
    }
  }

  function loadMap(scheme) {
    const container = document.getElementById("map-container");
    if (!container) {
      return;
    }

    container.replaceChildren();

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.id = "mapmyvisitors";
    script.src =
      scheme === "slate"
        ? "https://mapmyvisitors.com/map.js?cl=ffffff&w=a&t=tt&d=AW6RVWNwzLEyhknDhkn3Cr9N0KYuZO-ObNBbBJjnQz4&co=1e2129&ct=ffffff&cmo=5ddfef&cmn=d354b9"
        : "https://mapmyvisitors.com/map.js?cl=4051b5&w=a&t=tt&d=AW6RVWNwzLEyhknDhkn3Cr9N0KYuZO-ObNBbBJjnQz4&co=ffffff&ct=4051b5&cmo=5ddfef&cmn=d354b9";
    container.appendChild(script);
  }

  window.addEventListener("load", function () {
    const scheme = currentScheme();
    loadMap(scheme);
    setGiscusTheme(scheme);

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.attributeName === "data-md-color-scheme") {
          const nextScheme = currentScheme();
          loadMap(nextScheme);
          setGiscusTheme(nextScheme);
        }
      });
    });

    observer.observe(document.body, { attributes: true });
  });
})();
