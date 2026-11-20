// ============================================================================
// FailMore launch animation. Plays once per app launch, over whatever the app renders underneath.
// 1. white  2. the F in its purple box slams onto the center  3. the box floods the screen, flames at
// low opacity for texture  4. the F slides left as "ail" appears  5. "More" glitches in  6. fade away.
// Tap anywhere to skip. Reduced Motion: the finished wordmark on purple, then a fade.
// ============================================================================
(function () {
  var el = document.getElementById('splash');
  if (!el) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var done = false, timers = [];
  function finish() {
    if (done) return; done = true;
    timers.forEach(clearTimeout);
    el.classList.add('out');
    window.dispatchEvent(new Event('failmore:splashdone'));
    setTimeout(function () { if (anim) anim.destroy(); el.remove(); }, 400);
  }
  el.addEventListener('click', finish);

  // the F starts at the center of the screen; this is how far that is from its place in the wordmark
  function place() {
    var word = el.querySelector('.sp-word'), f = el.querySelector('.sp-f');
    var box = el.getBoundingClientRect(), r = f.getBoundingClientRect();
    word.style.setProperty('--fx', ((box.left + box.width / 2) - (r.left + r.width / 2)).toFixed(1) + 'px');
  }

  var anim = null;
  function flames() {
    if (!window.lottie || reduce) return;
    fetch('./assets/flame.json').then(function (r) { return r.json(); }).then(function (d) {
      if (done) return;
      anim = window.lottie.loadAnimation({ container: el.querySelector('.sp-flame'), renderer: 'svg', loop: true, autoplay: true, animationData: d,
        rendererSettings: { preserveAspectRatio: 'xMidYMax meet' } });
    }).catch(function () {});
  }

  var started = false;
  function start() {
    if (started) return; started = true;
    place();
    flames();
    el.classList.add(reduce ? 'still' : 'go');
    timers.push(setTimeout(finish, reduce ? 1200 : 2750));
  }
  // wait (briefly) for the wordmark font so the F lands exactly where the word puts it
  if (document.fonts && document.fonts.load) {
    document.fonts.load('800 45px Archivo').then(start, start);
    setTimeout(start, 700);
  } else start();
})();
