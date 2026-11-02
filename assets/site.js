// Small enhancements only. The page reads correctly without this file.
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* The page is the challenge: scrolling moves through days 1 to 21. */
  var heroBlocks = Array.prototype.slice.call(document.querySelectorAll(".hero-chain .chain i"));
  var dayLabel = document.querySelector("[data-day]");
  var hero = document.querySelector(".hero");

  if (heroBlocks.length && hero) {
    var progress = document.createElement("div");
    var bar = document.createElement("div");
    var chip = document.createElement("div");
    progress.className = "progress";
    progress.setAttribute("aria-hidden", "true");
    bar.className = "progress-bar";
    chip.className = "progress-day";
    for (var d = 0; d < 21; d++) {
      bar.appendChild(document.createElement("i"));
    }
    progress.appendChild(bar);
    progress.appendChild(chip);
    document.body.appendChild(progress);

    var barBlocks = Array.prototype.slice.call(bar.children);
    heroBlocks.forEach(function (block, i) {
      block.style.setProperty("--i", i);
    });

    var paint = function (blocks, day, finished) {
      blocks.forEach(function (block, i) {
        block.classList.toggle("on", i < day - 1 || finished);
        block.classList.toggle("now", i === day - 1 && !finished);
      });
    };

    var lastDay = 0;
    var queued = false;
    var update = function () {
      queued = false;
      var finale = document.querySelector(".finale");
      var finaleTop = finale.getBoundingClientRect().top;
      var range = finaleTop + window.scrollY - window.innerHeight * 0.6;
      var share = range > 0 ? window.scrollY / range : 0;
      var day = Math.min(21, Math.max(1, Math.ceil(share * 21)));
      var finished = share >= 1;
      progress.classList.toggle("show", hero.getBoundingClientRect().bottom < 40);
      var key = finished ? 22 : day;
      if (key === lastDay) {
        return;
      }
      lastDay = key;
      paint(heroBlocks, day, finished);
      paint(barBlocks, day, finished);
      chip.textContent = finished ? "21 / 21" : "Day " + day + " of 21";
      if (dayLabel) {
        dayLabel.textContent = day;
      }
    };
    var request = function () {
      if (!queued) {
        queued = true;
        window.requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    update();
  }

  /* Body points: the same style as the app's workout camera. */
  var mix = function (a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  var along = function (from, to, share) {
    return mix(from, to, share);
  };
  var ease = function (t) {
    return t * t * (3 - 2 * t);
  };

  var poses = {
    pushup: function (t) {
      var ankle = [62, 482];
      var wrist = [272, 482];
      var shoulder = mix([276, 392], [292, 452], t);
      return {
        head: [shoulder[0] + 20, shoulder[1] - 18],
        shoulder: shoulder,
        elbow: mix([274, 437], [245, 446], t),
        wrist: wrist,
        hip: along(ankle, shoulder, 0.53),
        knee: along(ankle, shoulder, 0.2),
        ankle: ankle
      };
    },
    squat: function (t) {
      return {
        head: mix([198, 296], [232, 362], t),
        shoulder: mix([196, 318], [218, 384], t),
        elbow: mix([196, 356], [258, 382], t),
        wrist: mix([198, 392], [296, 384], t),
        hip: mix([192, 378], [182, 432], t),
        knee: mix([197, 430], [232, 446], t),
        ankle: [195, 480]
      };
    },
    plank: function (t) {
      var ankle = [62, 482];
      var shoulder = [282, 404 - t * 1.6];
      return {
        head: [302, 390 - t * 1.6],
        shoulder: shoulder,
        elbow: [282, 470],
        wrist: [332, 478],
        hip: along(ankle, shoulder, 0.53),
        knee: along(ankle, shoulder, 0.2),
        ankle: ankle
      };
    }
  };

  var drawBody = function (svg, pose) {
    var path = function (name, points) {
      var el = svg.querySelector('[data-b="' + name + '"]');
      if (el) {
        el.setAttribute("d", "M" + points.map(function (p) {
          return p[0].toFixed(1) + " " + p[1].toFixed(1);
        }).join(" L"));
      }
    };
    var torso = [pose.shoulder, pose.hip, pose.knee, pose.ankle];
    var arm = [pose.shoulder, pose.elbow, pose.wrist];
    path("flesh-torso", torso);
    path("flesh-arm", arm);
    path("line-neck", [pose.head, pose.shoulder]);
    path("line-arm", arm);
    path("line-torso", torso);
    ["head", "shoulder", "elbow", "wrist", "hip", "knee", "ankle"].forEach(function (name) {
      svg.querySelectorAll('[data-j="' + name + '"]').forEach(function (joint) {
        joint.setAttribute("cx", pose[name][0].toFixed(1));
        joint.setAttribute("cy", pose[name][1].toFixed(1));
      });
    });
  };

  var whenSeen = function (el, onEnter, onLeave) {
    if (!("IntersectionObserver" in window)) {
      return;
    }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          onEnter();
        } else if (onLeave) {
          onLeave();
        }
      });
    }, { threshold: 0.45 }).observe(el);
  };

  // Plays a short set of reps when it scrolls into view, then stops by itself.
  var playReps = function (svg, reps, repMs, onRep, onStart, onEnd) {
    var pose = poses[svg.getAttribute("data-pose")];
    var rest = svg.getAttribute("data-rest") === "1" ? 1 : 0;
    var running = false;
    var seenAgain = true;
    whenSeen(svg, function () {
      if (running || !seenAgain) {
        return;
      }
      running = true;
      seenAgain = false;
      if (onStart) {
        onStart();
      }
      var start = null;
      var doneReps = 0;
      var frame = function (now) {
        if (start === null) {
          start = now;
        }
        var position = (now - start) / repMs;
        var rep = Math.floor(position);
        if (rep > doneReps) {
          doneReps = rep;
          if (onRep) {
            onRep(doneReps);
          }
        }
        if (position >= reps) {
          drawBody(svg, pose(rest));
          running = false;
          if (onEnd) {
            onEnd();
          }
          return;
        }
        var phase = position - rep;
        var depth = phase < 0.5 ? ease(phase * 2) : ease((1 - phase) * 2);
        drawBody(svg, pose(rest ? 1 - depth : depth));
        window.requestAnimationFrame(frame);
      };
      window.requestAnimationFrame(frame);
    }, function () {
      seenAgain = true;
    });
  };

  if (!calm) {
    var workout = document.querySelector("[data-workout]");
    if (workout) {
      var counter = workout.querySelector("[data-count]");
      var togo = workout.querySelector("[data-togo]");
      var fill = workout.querySelector("[data-fill]");
      var cue = workout.querySelector("[data-cue]");
      var body = workout.querySelector("svg[data-pose]");
      var target = 40;
      var first = 37;
      var showCount = function (n) {
        counter.textContent = n;
        togo.textContent = n >= target ? "Done" : (target - n) + " to go";
        fill.style.width = (n / target * 100) + "%";
      };
      var hideCue;
      playReps(body, 3, 1250, function (rep) {
        showCount(first + rep);
        cue.classList.add("show");
        body.classList.add("counted");
        window.clearTimeout(hideCue);
        hideCue = window.setTimeout(function () {
          cue.classList.remove("show");
          body.classList.remove("counted");
        }, 620);
      }, function () {
        showCount(first);
      }, function () {
        showCount(target);
        cue.classList.add("show");
        body.classList.add("counted");
        window.clearTimeout(hideCue);
      });
    }

    document.querySelectorAll(".tile svg[data-pose]").forEach(function (svg) {
      var isPlank = svg.getAttribute("data-pose") === "plank";
      playReps(svg, isPlank ? 3 : 2, isPlank ? 1500 : 1500);
    });
  }

  /* Example pool. Same rule as the payout code: fee = min(12% of pool, non-finishers' entries),
     each finisher's share is rounded down to the cent. */
  var pool = document.querySelector("[data-pool]");
  if (pool) {
    var size = 50;
    var slider = pool.querySelector("[data-finishers]");
    var people = Array.prototype.slice.call(pool.querySelectorAll(".pool-people i"));
    var out = function (name) {
      return pool.querySelector('[data-out="' + name + '"]');
    };
    var money = function (cents, whole) {
      var value = cents / 100;
      return "€" + value.toLocaleString("en-GB", {
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: 2
      });
    };

    var calculate = function () {
      var checked = pool.querySelector('input[name="entry"]:checked');
      var entry = parseInt(checked.value, 10) * 100;
      var finished = parseInt(slider.value, 10);
      var missed = size - finished;
      var total = size * entry;
      var theirs = missed * entry;
      var fee = Math.min(Math.round(total * 12 / 100), theirs);
      var shared = theirs - fee;
      var share = Math.floor(shared / finished);

      out("finished").textContent = finished;
      out("finished-key").textContent = finished;
      out("missed-key").textContent = missed;
      out("intro").textContent = "Imagine " + size + " people join with " + money(entry, true) + " each, so the pool is " + money(total, true) + ". " + finished + " finish and " + missed + " don't.";
      out("theirs-label").textContent = "Entries of the " + missed + " who didn't finish";
      out("theirs").textContent = money(theirs);
      out("fee-label").textContent = "Holdout's fee, 12% of the " + money(total, true) + " pool";
      out("fee").textContent = (fee ? "−" : "") + money(fee);
      out("shared-label").textContent = "Shared among the " + finished + " who finished";
      out("shared").textContent = money(shared);
      out("each").textContent = money(entry + share);
      out("explain").textContent = money(entry + share) + " is the " + money(entry, true) + " entry plus a " + money(share) + " share, rounded down to the cent. This is an illustration, not a forecast. What you get depends on who finishes.";

      var message;
      if (missed === 0) {
        message = "Everyone finished, so there's no fee and everyone gets their entry back.";
      } else if (fee === theirs) {
        message = "Few people dropped out, so the fee stops at their entries. Finishers get exactly their entry back.";
      } else {
        message = "The fee comes only from the entries of those who didn't finish.";
      }
      out("message").textContent = message;

      slider.setAttribute("aria-valuetext", finished + " of " + size + " people finish");
      slider.style.setProperty("--fill", ((finished - slider.min) / (slider.max - slider.min) * 100) + "%");
      people.forEach(function (person, i) {
        person.classList.toggle("in", i < finished);
      });
    };

    pool.addEventListener("input", calculate);
    calculate();
  }
})();
