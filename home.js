/* Página inicial (index.html): seção "Como usar" (abas, player e lista dos vídeos).
 * window.__ROTEIROS (os roteiros) vem de um bloco no index.html; window.__videos, de videos/videos.js. */
/* Seção "Como usar": a lista vem dos roteiros (embutida na geração do site); os arquivos de vídeo,
   de videos/videos.js quando já foram gravados. Sem vídeo, mostra só o passo a passo. */
(function () {
  var STORYBOARDS = window.__ROTEIROS;
  var RECORDED = (window.__videos && (window.__videos.files || window.__videos.arquivos)) || {};
  var GROUPS = STORYBOARDS.grupos,
    VIDEOS = STORYBOARDS.videos;
  var reducedMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var phone = window.matchMedia && matchMedia("(max-width: 700px)").matches;
  var tabs = document.getElementById("howto-tabs"),
    listSheet = document.getElementById("howto-list");
  var screenEl = document.getElementById("howto-screen"),
    steps = document.getElementById("howto-steps");
  var currentGroup = GROUPS[0].id;
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fileInput(v) {
    var r = RECORDED[v.id];
    if (!r) return null;
    // aceita também o índice antigo (celular/computador, capa/tempos/duracao) até os vídeos serem regravados
    var p = r.phone || r.celular,
      d = r.desktop || r.computador;
    var a = phone ? p || d : d || p;
    if (!a) return null;
    return {
      webm: a.webm,
      mp4: a.mp4,
      vtt: a.vtt,
      cover: a.cover || a.capa,
      times: a.times || a.tempos,
      duration: a.duration || a.duracao
    };
  }
  function display(v, doScroll) {
    document.getElementById("howto-num").textContent =
      "Vídeo " +
      v.n +
      " · " +
      GROUPS.filter(function (g) {
        return g.id === v.grupo;
      })[0].nome;
    document.getElementById("howto-title").textContent = v.titulo;
    steps.innerHTML = v.steps
      .map(function (p) {
        return "<li>" + esc(p) + "</li>";
      })
      .join("");
    var a = fileInput(v);
    screenEl.innerHTML = "";
    if (a && !reducedMotion) {
      var vid = el("video", {
        controls: "",
        muted: "",
        playsinline: "",
        loop: "",
        preload: "metadata",
        poster: a.cover || "",
        "aria-label": v.titulo
      });
      vid.muted = true;
      if (a.webm) vid.appendChild(el("source", { src: a.webm, type: "video/webm" }));
      if (a.mp4) vid.appendChild(el("source", { src: a.mp4, type: "video/mp4" }));
      if (a.vtt) vid.appendChild(el("track", { kind: "captions", srclang: "pt", label: "Português", src: a.vtt, default: "" }));
      vid.addEventListener("timeupdate", function () {
        var t = vid.currentTime,
          i = -1;
        (a.times || []).forEach(function (s, k) {
          if (t >= s) i = k;
        });
        [].forEach.call(steps.children, function (li, k) {
          li.className = k === i ? "on" : "";
        });
      });
      screenEl.appendChild(vid);
      if ("IntersectionObserver" in window)
        new IntersectionObserver(
          function (es) {
            es.forEach(function (e) {
              if (e.isIntersecting) vid.play().catch(function () {});
              else vid.pause();
            });
          },
          { threshold: 0.5 }
        ).observe(vid);
    } else if (a && a.cover) {
      screenEl.appendChild(el("img", { src: a.cover, alt: v.titulo, style: "width:100%;border-radius:12px" }));
    } else {
      screenEl.appendChild(
        el(
          "div",
          { class: "sem" },
          v.ready === false ? "Este vídeo será gravado quando a função for lançada." : "Vídeo em preparação. Siga o passo a passo ao lado."
        )
      );
    }
    [].forEach.call(listSheet.children, function (b) {
      b.setAttribute("aria-current", b.dataset.id === v.id ? "true" : "false");
    });
    if (doScroll) document.getElementById("howto-player").scrollIntoView({ block: "start" });
  }
  function grupo(id, choose) {
    currentGroup = id;
    [].forEach.call(tabs.children, function (t) {
      t.setAttribute("aria-selected", t.dataset.g === id ? "true" : "false");
    });
    var vs = VIDEOS.filter(function (v) {
      return v.grupo === id;
    });
    listSheet.innerHTML = "";
    vs.forEach(function (v) {
      var a = fileInput(v);
      var b = el("button", { class: "vid", type: "button", "data-id": v.id, id: "v-" + v.id });
      b.innerHTML =
        '<span class="capa">' +
        (a && a.cover ? '<img src="' + esc(a.cover) + '" alt="" loading="lazy">' : '<span class="n">' + v.n + "</span>") +
        (a && a.duration ? '<span class="dur">' + esc(a.duration) + "</span>" : "") +
        (v.ready === false ? '<span class="badge soon">Quando a função sair</span>' : "") +
        "</span>" +
        "<b>" +
        v.n +
        ". " +
        esc(v.titulo) +
        '</b><span class="d">' +
        esc(v.desc) +
        "</span>";
      b.addEventListener("click", function () {
        display(v, true);
      });
      listSheet.appendChild(b);
    });
    if (choose !== false && vs.length) display(vs[0]);
  }
  GROUPS.forEach(function (g) {
    var n = VIDEOS.filter(function (v) {
      return v.grupo === g.id;
    }).length;
    if (!n) return;
    var t = el(
      "button",
      { class: "tab", role: "tab", type: "button", "data-g": g.id, "aria-selected": "false" },
      esc(g.nome) + "<small>" + n + "</small>"
    );
    t.addEventListener("click", function () {
      grupo(g.id);
    });
    tabs.appendChild(t);
  });
  function byHash() {
    var m = /^#v-(\w+)$/.exec(location.hash);
    if (!m) return false;
    var v = VIDEOS.filter(function (x) {
      return x.id === m[1];
    })[0];
    if (!v) return false;
    grupo(v.grupo, false);
    display(v, true);
    return true;
  }
  if (!byHash()) grupo(currentGroup);
  window.addEventListener("hashchange", byHash);
})();
