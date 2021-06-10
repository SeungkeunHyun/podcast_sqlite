class DakchoV4_Player {
    constructor(divId, mid, murl) {
        this.self = this;
        this.initPlayer(mid, murl);
        this.controller = $(divId);
        this.addEvents();
    }

    initPlayer(mid, murl) {
        var self = this;
        if (self.player && !self.player.paused) {
            self.player.pause();
        }
        for (var k in soundManager.sounds) {
            try {
                soundManager.sounds[k].destruct();
            } catch (err) {
                console.error(err);
            }
        }
        //soundManager.beginDelayedInit();
        this.player = soundManager.createSound({
            id: mid,
            url: murl,
            whileplaying: DakchoV4_Player.updateProgressBar,
            onpause: DakchoV4_Player.recordHistory
        });
        this.player.options.onabort = this.player.options.onpause = DakchoV4_Player.recordHistory;
        this.player.options.onplay = DakchoV4_Player.playSound;
        this.player.options.onresume = function (e) {
            $("#mediaPlayer span.glyphicon-play").removeClass("glyphicon-play").addClass("glyphicon-pause");
        }
        this.player.options.onfinish = function (e) {
            $("#mediaPlayer span.glyphicon-pause").removeClass("glyphicon-pause").addClass("glyphicon-play");
            DakchoV4_Player.clearHistory(this);
            setTimeout(DakchoV4_Player.moveOne(self, -1), 1500);
        }
    }

    static playSound(e) {
        var jsonDat = LocalStorageUtil.getItemFromLocalStorage("playHistory", "url", this.url);
        if (jsonDat) {
            this.setPosition(jsonDat.position);
        }
        $("#mediaPlayer span.glyphicon-play").removeClass("glyphicon-play").addClass("glyphicon-pause");
    }

    static clearHistory(snd) {
        console.log(snd);
        LocalStorageUtil.removeItemFromLocalStorage("playHistory", "url", snd.url);
        $("#mediaPlayer span.glyphicon-pause").removeClass("glyphicon-pause").addClass("glyphicon-play");
        //this.setPosition(0);
    }

    static recordHistory() {
        var $img = $("#mediaPlayer div.media-left img");
        var hist = {
            "url": this.url,
            "image": $img.attr("src"),
            "album": $img.attr("title"),
            "artist": $img.attr("alt"),
            "title": this.id,
            "position": this.position,
            "stoppedAt": new Date().getTime()
        };
        $("#mediaPlayer span.glyphicon-pause").removeClass("glyphicon-pause").addClass("glyphicon-play");
        LocalStorageUtil.registerLocalStorage("playHistory", "url", hist);
        console.log(hist);
    }
    play() {
        this.player.play();
    }

    pause() {
        this.player.pause();
    }

    move(pct) {
        var timeToMove = (pct / 100 * this.player.duration)
        this.player.setPosition(timeToMove);
        console.log(timeToMove, this);
    }

    addPosition(secs) {
        this.player.setPosition(this.player.position + (secs * 1000));
    }

    appendPlayList(dat) {
        var self = this;
        var $ul = this.controller.find("ul");
        console.log(dat, $ul);
        $.each(dat, function (i, itm) {
            var $li = $("<li data-pubdate='" + itm.pubDate + "'><a href='#'>" + itm.title + "</a></li>");
            $li.data(itm);
            $ul.append($li);
        });
        $ul.on("click", "li", function () {
            var $li = $(this);
            var lidat = $li.data();
            console.log("clicked item", $li.data());
            if (!lidat.hasOwnProperty("link")) {
                lidat.link = lidat.url;
            }
            self.initPlayer(lidat.title, lidat.link);
            self.controller.find("img").attr("src", lidat.image);
            self.player.play();
            self.controller.find("h4.media-heading").text(this.textContent);
        });
        $ul.closest("div").on("show.bs.dropdown", function () {
            $.each($ul.find("li"), function (i, o) {
                console.log(o, self);
                if ($(o).data('title') == self.player.id) {
                    $(o).addClass("active");
                    return;
                } else {
                    $(o).removeClass("active");
                }
            });
        });
    }

    static updateProgressBar() {
        var pct = parseInt((this.position / this.duration) * 100);
        var $pgbar = $("div.progress-bar");
        $pgbar.css('width', pct + '%');
        $pgbar.attr("aria-valuenow", pct);
        $("div.time-info").text(DakchoV4_Player.showTime(this.position) + " of " + DakchoV4_Player.showTime(this.duration));
    }

    static showTime(msec) {
        var sec = parseInt(msec / 1000);
        return parseInt(sec / 3600) + ":" + (parseInt(sec % 3600 / 60) >= 10 ? parseInt(sec % 3600 / 60) : "0" + parseInt(sec % 3600 / 60)) + ":" + (sec % 60 >= 10 ? (sec % 60) : "0" + (sec % 60));
    }

    addEvents() {
        var self = this;
        this.controller.on("click", "span", function () {
            var $btn = $(this);
            if ($btn.hasClass("glyphicon-pause")) {
                self.player.pause();
                console.log($btn);
                return;
            } else if ($btn.hasClass("glyphicon-play")) {
                self.player.play();
                return;
            } else if ($btn.hasClass("glyphicon-backward")) {
                self.addPosition(-30);
                return;
            } else if ($btn.hasClass("glyphicon-forward")) {
                self.addPosition(30);
                return;
            } else if ($btn.hasClass("glyphicon-fast-forward")) {
                console.log(self.player.id);
                DakchoV4_Player.moveOne(self, 1);
                return;
            } else if ($btn.hasClass("glyphicon-fast-backward")) {
                console.log(self.player.id);
                DakchoV4_Player.moveOne(self, -1);
                return;
            } else if ($btn.hasClass("glyphicon-download-alt")) {
                var $img = $("#mediaPlayer div.media-left img");
                var snd = soundManager.sounds[soundManager.soundIDs[0]];
                var dat = {
                    "link": snd.url,
                    "img": $img.attr("src"),
                    "album": $img.attr("title"),
                    "artist": $img.attr("alt"),
                    "title": this.id,
                    "summary": ""
                };
                DakchoV4.downloadPodcast(dat);
            }
        });
    }

    static moveOne(obj, addTo) {
        var id = obj.player.id;
        var idx = 0;
        var lis = obj.controller.find("ul#playlist li")
        $.each(lis, function (i, o) {
            if ($(o).data('title') == id) {
                idx = i + addTo;
                return;
            }
        });
        if (idx < 0 || idx >= lis.length) {
            console.warn("No more move");
            return;
        }
        $(lis[idx]).trigger("click");
    }
}
