/* アート建工様 SUUMO フリーページ
   #includeContent は書き出し時に PC：#includeContent ／スマホ：#kosha_free に置き換わる。
   SUUMO の PC ページは jQuery 1.4 系、スマホは独自のため、jQuery に頼らない素の JavaScript で書く */
(function () {
  var root = document.querySelector("#includeContent .ak");
  if (!root || !root.querySelectorAll) return;

  // SVG 要素でも動くよう、class の付け外しは className ではなく属性で行う
  function hasClass(el, c) { return (" " + (el.getAttribute("class") || "") + " ").indexOf(" " + c + " ") > -1; }
  function setClass(el, c, on) {
    var list = (el.getAttribute("class") || "").split(/\s+/), out = [], i;
    for (i = 0; i < list.length; i++) if (list[i] && list[i] !== c) out.push(list[i]);
    if (on) out.push(c);
    el.setAttribute("class", out.join(" "));
  }
  function each(sel, fn, base) { var els = (base || root).querySelectorAll(sel); for (var i = 0; i < els.length; i++) fn(els[i]); }

  // JS が動く環境でだけ、開閉部分を閉じ、会場を1件ずつ表示にする
  setClass(root, "is-js", true);

  // ---- トップビジュアル：家の中身が順に落ちてきて組み上がる ----
  // アキュラホーム様と同じ考え方（0.48秒おきに1段ずつ .is-on）。
  // くり返すときは一瞬で消さず、ふわっと消してから組み直す
  var mv = root.querySelector("[data-ak-mv]");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (mv && !reduce) {
    setClass(mv, "is-js", true);
    var STEPS = 6, GAP = 480, HOLD = 3200, FADE = 650;
    var timers = [];
    // スマホではイラスト内の吹き出しが小さすぎるので、いま組み上がった段の説明をイラストの下に1行で出す
    var cap = mv.querySelector(".ak-mv__caption");
    var caption = function (n) {
      if (!cap) return;
      var tag = mv.querySelector('.ak-mv__step--tag[data-step="' + n + '"]');
      var num = tag && tag.querySelector(".ak-tag__num"), txt = tag && tag.querySelector(".ak-tag__text");
      cap.firstChild.textContent = num ? num.textContent : "";
      cap.lastChild.textContent = txt ? txt.textContent : "";
      setClass(cap, "is-show", !!num);
    };
    var later = function (fn, ms) { timers.push(setTimeout(fn, ms)); };
    var run = function () {
      setClass(mv, "is-out", false);
      setClass(mv, "is-warm", false);
      each(".ak-mv__step", function (g) { setClass(g, "is-on", false); }, mv);
      for (var s = 1; s <= STEPS; s++) {
        (function (n) {
          later(function () {
            each('.ak-mv__step[data-step="' + n + '"]', function (g) { setClass(g, "is-on", true); }, mv);
            caption(n);
            if (n === STEPS) setClass(mv, "is-warm", true);
          }, 80 + (n - 1) * GAP);
        })(s);
      }
      var end = 80 + (STEPS - 1) * GAP + 550 + HOLD;
      later(function () { setClass(mv, "is-out", true); if (cap) setClass(cap, "is-show", false); }, end);
      later(run, end + FADE);
    };
    // 画面に見えているときだけ動かす（見えていないあいだは止めておく）
    var started = false;
    var start = function () { if (!started) { started = true; run(); } };
    var stop = function () { started = false; for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]); timers = []; };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) start(); else stop();
      }, { threshold: 0.15 }).observe(mv);
    } else {
      start();
    }
  }

  // ---- ページ内リンク（会場へ移動など）----
  // SUUMO のページには <base href> があるため、"#..." のリンクはそのままだと SUUMO の別ページへ飛んでしまう。
  // JS でページ内の位置までスクロールさせる
  each("[data-ak-jump]", function (link) {
    link.onclick = function (e) {
      var id = (link.getAttribute("href") || "").replace(/^.*#/, "");
      var target = id && document.getElementById(id);
      if (!target) return true;
      if (e && e.preventDefault) e.preventDefault();
      // PC は SUUMO のヘッダーが上に固定されるのでその分（70px）、スマホは少しだけ手前で止める
      var offset = window.innerWidth < 768 ? 12 : 70;
      var top = target.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop) - offset;
      try { window.scrollTo({ top: top, behavior: "smooth" }); } catch (err) { window.scrollTo(0, top); }
      return false;
    };
  });

  // ---- もっと見る・よくある質問（開閉） ----
  each("[data-ak-more]", function (btn) {
    var box = btn.parentNode, body = box.querySelector(".ak-more__body");
    if (!body) return;
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", body.id);
    btn.onclick = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      var open = !hasClass(box, "is-open");
      setClass(box, "is-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      // 高さを数値にしてから動かす（height:auto には transition が効かないため）
      body.style.height = (open ? 0 : body.scrollHeight) + "px";
      body.offsetHeight; // 再計算させる
      body.style.height = (open ? body.scrollHeight + 14 : 0) + "px";
      if (open) setTimeout(function () { if (hasClass(box, "is-open")) body.style.height = "auto"; }, 450);
      return false;
    };
  });

  // ---- 会場マップ：地図の地名・タブのどちらからでも会場を切り替える ----
  var map = root.querySelector("[data-ak-map]");
  if (map) {
    var panelTop = map.querySelector(".ak-map__panel");
    var activate = function (area, fromMap) {
      each("[data-ak-map] [data-area]", function (el) {
        var on = el.getAttribute("data-area") === area;
        setClass(el, "is-active", on);
        if (el.getAttribute("role") === "tab") el.setAttribute("aria-selected", on ? "true" : "false");
      });
      // スマホで地図を押したときは、切り替わった会場情報が見える位置まで送る
      if (fromMap && panelTop && window.innerWidth < 768 && panelTop.getBoundingClientRect) {
        var top = panelTop.getBoundingClientRect().top;
        if (top > window.innerHeight * 0.6) window.scrollBy(0, top - 16);
      }
    };
    each("[data-ak-map] .ak-tabs__btn", function (tab) {
      tab.onclick = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        activate(tab.getAttribute("data-area"), false);
        return false;
      };
    });
    each("[data-ak-map] .ak-map__spot", function (spot) {
      var go = function () { activate(spot.getAttribute("data-area"), true); };
      spot.onclick = go;
      spot.onkeydown = function (e) {
        var k = e.key || e.keyCode;
        if (k === "Enter" || k === " " || k === 13 || k === 32) { if (e.preventDefault) e.preventDefault(); go(); }
      };
    });
    activate("yonago", false);
  }
})();
