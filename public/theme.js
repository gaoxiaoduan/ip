(function () {
  var STORAGE_KEY = "ip-exit-observer-theme";
  var NEXT = { system: "light", light: "dark", dark: "system" };
  var LABELS = {
    system: "当前：跟随系统。点击切换为浅色",
    light: "当前：浅色。点击切换为深色",
    dark: "当前：深色。点击切换为跟随系统",
  };

  function getTheme() {
    try {
      var val = localStorage.getItem(STORAGE_KEY);
      return val === "light" || val === "dark" ? val : "system";
    } catch (e) {
      return "system";
    }
  }

  function applyTheme(theme) {
    var root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    } else if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("light");
      root.classList.remove("dark");
      root.removeAttribute("data-theme");
    }

    var btn = document.getElementById("theme-toggle");
    if (btn) {
      var label = LABELS[theme] || LABELS.system;
      btn.setAttribute("aria-label", label);
      btn.setAttribute("title", label);
    }
  }

  var current = getTheme();
  applyTheme(current);

  function bindToggle() {
    applyTheme(current);
    var btn = document.getElementById("theme-toggle");
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "true";
    btn.addEventListener("click", function () {
      current = NEXT[current] || "system";
      try {
        localStorage.setItem(STORAGE_KEY, current);
      } catch (e) {}
      applyTheme(current);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindToggle);
  } else {
    bindToggle();
  }

  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY) {
      current = getTheme();
      applyTheme(current);
    }
  });
})();
