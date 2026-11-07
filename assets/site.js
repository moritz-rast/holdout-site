// Small enhancements only. The page reads correctly without this file.
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  // Loops reps while the drawing is on screen, and stops off screen.
  var loopReps = function (svg, repMs, onRep, resting) {
    var pose = poses[svg.getAttribute("data-pose")];
    var rest = svg.getAttribute("data-rest") === "1" ? 1 : 0;
    var seen = false;
    var frameId = null;
    var start = null;
    var doneReps = 0;
    var frame = function (now) {
      if (start === null) {
        start = now - doneReps * repMs;
      }
      var position = (now - start) / repMs;
      var rep = Math.floor(position);
      if (rep > doneReps) {
        doneReps = rep;
        if (onRep) {
          onRep(doneReps);
        }
      }
      var phase = position - rep;
      var depth = phase < 0.5 ? ease(phase * 2) : ease((1 - phase) * 2);
      if (resting && resting(rep)) {
        depth = 0;
      }
      drawBody(svg, pose(rest ? 1 - depth : depth));
      frameId = window.requestAnimationFrame(frame);
    };
    var sync = function () {
      var run = seen;
      if (run && frameId === null) {
        start = null;
        frameId = window.requestAnimationFrame(frame);
      } else if (!run && frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
        drawBody(svg, pose(rest));
      }
    };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        seen = entries[entries.length - 1].isIntersecting;
        sync();
      }, { threshold: 0.3 }).observe(svg);
    }
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
      var first = 32;
      var holdReps = 2;
      var showCount = function (n) {
        counter.textContent = n;
        togo.textContent = n >= target ? "Done" : (target - n) + " to go";
        fill.style.width = (n / target * 100) + "%";
      };
      var hideCue;
      // A cycle is 8 counted reps up to 40, then a short rest, then it starts again.
      var cycle = target - first + holdReps;
      loopReps(body, 1300, function (rep) {
        var inCycle = rep % cycle;
        if (inCycle === 0) {
          showCount(first);
          return;
        }
        if (inCycle > target - first) {
          return;
        }
        showCount(first + inCycle);
        cue.classList.add("show");
        body.classList.add("counted");
        window.clearTimeout(hideCue);
        hideCue = window.setTimeout(function () {
          cue.classList.remove("show");
          body.classList.remove("counted");
        }, 620);
      }, function (rep) {
        return rep % cycle >= target - first;
      });
      showCount(first);
    }

    document.querySelectorAll(".tile svg[data-pose]").forEach(function (svg) {
      loopReps(svg, svg.getAttribute("data-pose") === "plank" ? 2200 : 1600);
    });
  }

  /* Example: what a finisher gets back. Same rule as the payout code, for a pool of 100:
     fee = min(12% of all entries, entries of those who didn't finish),
     each finisher's share is rounded down to the cent. */
  var pool = document.querySelector("[data-pool]");
  if (pool) {
    var size = 100;
    var slider = pool.querySelector("[data-missed]");
    var people = Array.prototype.slice.call(pool.querySelectorAll(".pool-people i"));
    var out = function (name) {
      return pool.querySelector('[data-out="' + name + '"]');
    };
    var money = function (cents, whole) {
      return "€" + (cents / 100).toLocaleString("en-GB", {
        minimumFractionDigits: whole ? 0 : 2,
        maximumFractionDigits: 2
      });
    };

    var calculate = function () {
      var entry = parseInt(pool.querySelector('input[name="entry"]:checked').value, 10) * 100;
      var missed = parseInt(slider.value, 10);
      var finished = size - missed;
      var theirs = missed * entry;
      var kept = Math.min(Math.round(size * entry * 12 / 100), theirs);
      var share = Math.floor((theirs - kept) / finished);

      out("missed").textContent = missed;
      out("each").textContent = money(entry + share);
      if (missed === 0) {
        out("split").textContent = "Everyone finished, so everyone gets their " + money(entry, true) + " entry back.";
      } else if (share === 0) {
        out("split").textContent = "Your " + money(entry, true) + " entry back. When this few drop out, there's no share.";
      } else {
        out("split").textContent = "Your " + money(entry, true) + " entry plus a " + money(share) + " share.";
      }
      slider.setAttribute("aria-valuetext", missed + " of 100 people don't finish");
      slider.style.setProperty("--fill", (missed / slider.max * 100) + "%");
      people.forEach(function (person, i) {
        if (i > 0) {
          person.classList.toggle("in", i < finished);
        }
      });
    };

    pool.addEventListener("input", calculate);
    calculate();
  }
})();
