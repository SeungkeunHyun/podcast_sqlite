jQuery.download = function (url, data, tgt) {
    //url and data options required
    if (url && data) {
        //data can be string of parameters or array/object
        console.log(data);
        if (data.lnk.toLowerCase().indexOf(".mp3") == -1) {
            let $frame = $("#dlFrame");
            $frame.attr("src", "/php/util/downloadBinary.php?url=" + data.lnk);
            return;
        }
        var $frm = $("#frmDownload");
        if (!$frm.length) {
            $frm = jQuery(
                '<form id="frmDownload" accept-charset="UTF-8" action="' +
                url +
                '" target="' +
                tgt +
                '" method="post"></form>'
            );
            $frm.appendTo("body");
        }
        $frm.empty();
        var inputs = "";
        for (var k in data) {
            $frm.append(
                `<input type="hidden" name="${k}" value="${
          data[k] ? data[k].replace(/"/g, "'") : ""
        }" />\n`
            );
        }
        //send request
        console.log($frm[0]);
        $frm.submit();
    }
};

Date.prototype.addHours = function (h) {
    this.setTime(this.getTime() + h * 60 * 60 * 1000);
    return this;
};

class DakchoV4_Utils {
    static get itunes_srch_pfix() {
        return "https://itunes.apple.com/kr/podcast/id";
    }

    static loadPodcast(pcInfo) {
        return new Promise(function (resolve, reject) {
            if (pcInfo.url.match(/www.podty/)) {
                console.info("found podty original!");
                $.get("/php/util/fetchURL.php?uri=" + pcInfo.url)
                    .then(function (dat) {
                        var doc = DakchoV4_Utils.convertPodtyHTMLToRSS(dat);
                        resolve(doc);
                    })
                    .catch(function (ex) {
                        console.error(ex);
                        reject(ex);
                    });
            } else if (pcInfo.url.match(/naver.com/)) {
                console.info("found naver original!");
                $.get("/php/util/fetchURL.php?uri=" + pcInfo.url)
                    .then(function (dat) {
                        var doc = DakchoV4_Utils.convertNaverHTMLToRSS(dat);
                        resolve(doc);
                    })
                    .catch(function (ex) {
                        console.error(ex);
                        reject(ex);
                    });
            } else {
                DakchoV4_Utils.loadURL(pcInfo.url)
                    .then(function (dat) {
                        if (dat == null || dat.documentElement == undefined) {
                            throw "Loaded RSS is invalid";
                        }
                        resolve(dat);
                    })
                    .catch(function (ex) {
                        console.error(
                            ex,
                            DakchoV4_Utils.itunes_srch_pfix + pcInfo.podcastId
                        );
                        $.get(DakchoV4_Utils.itunes_srch_pfix + pcInfo.podcastId)
                            .then(function (dat) {
                                var doc = DakchoV4_Utils.convertHTMLToRSS(dat);
                                resolve(doc);
                            })
                            .catch(function (ex) {
                                console.error(ex);
                                reject(ex);
                            });
                    });
            }
        });
    }

    static convertNaverHTMLToRSS(dat) {
        var $dat = $(dat);
        var $rows = $dat.find("ul.audioclip_playlist li");
        //var ns_itunes = "http://www.itunes.com/dtds/podcast-1.0.dtd";
        //var $ndata = $(`<rss xmlns:itunes="${ns_itunes}" xmlns:media="http://search.yahoo.com/mrss/" xmlns:feedburner="http://rssnamespace.org/feedburner/ext/1.0" version="2.0"><channel></channel></rss>`);
        var $ndata = DakchoV4_Utils.getRSSNode();
        var $chan = $ndata.find("channel");
        $chan.append(`<title>${$dat.find("h3.title").text()}</title>`);
        var artist = $dat.find("strong.provider").text();
        $chan.append(`<itunes:author>${artist}</itunes:author>`);
        $chan.append(
            `<itunes:image href='${$dat.find("div.article_thumb img").attr("src")}'/>`
        );
        $chan.append(
            `<itunes:summary>${$dat
        .find("p#description")
        .text()
        .trim()}</itunes:summary>`
        );

        $.each($rows, function (i, o) {
            var itm = document.createElement("item");
            $chan.append(itm);
            var ttl = document.createElement("title");
            itm.appendChild(ttl);
            ttl.textContent = o.querySelector("strong.info_title").textContent;
            var enc = document.createElement("enclosure");
            enc.setAttribute("url", o.getAttribute("data-play-uri"));
            itm.appendChild(enc);
            var summary = document.createElement("itunes:summary"); // <itunes:summary></itunes:summary>" +
            summary.textContent = "";
            itm.appendChild(summary);
            var pdat = document.createElement("pubDate");
            pdat.textContent =
                o.querySelector("time.date").textContent.replace(/[.]/g, "-") +
                "T00:00:00.000Z";
            itm.appendChild(pdat);
            var dura = document.createElement("itunes:duration");
            dura.textContent = o.querySelector("time.playTime").textContent.trim();
            itm.appendChild(dura);
        });
        console.info(
            "converted rss from podty",
            $.parseXML($ndata[0].outerHTML.replace(/&nbsp;/gi, " "))
        );
        return $.parseXML($ndata[0].outerHTML.replace(/&nbsp;/gi, " "));
    }

    static getRSSNode() {
        var ns_itunes = "http://www.itunes.com/dtds/podcast-1.0.dtd";
        return $(
            `<rss xmlns:itunes="${ns_itunes}" xmlns:media="http://search.yahoo.com/mrss/" xmlns:feedburner="http://rssnamespace.org/feedburner/ext/1.0" version="2.0"><channel></channel></rss>`
        );
    }

    static convertPodtyHTMLToRSS(dat) {
        var $dat = $(dat);
        var $rows = $($dat.find("ul.episodeList")[0]).find("li");
        //var ns_itunes = "http://www.itunes.com/dtds/podcast-1.0.dtd";
        var $ndata = DakchoV4_Utils.getRSSNode(); //$(`<rss xmlns:itunes="${ns_itunes}" xmlns:media="http://search.yahoo.com/mrss/" xmlns:feedburner="http://rssnamespace.org/feedburner/ext/1.0" version="2.0"><channel></channel></rss>`);
        var $chan = $ndata.find("channel");
        $chan.append(`<title>${$dat.find("div.name p").text()}</title>`);
        var artist = $dat.find("ul.subInfo li")[0].querySelector("strong")
            .textContent;
        $chan.append(`<itunes:author>${artist}</itunes:author>`);
        $chan.append(
            `<itunes:image href='${$dat.find("div.thumbnail img").attr("src")}'/>`
        );
        $chan.append(
            `<itunes:summary>${$dat
        .find("div.intro p")
        .text()
        .trim()}</itunes:summary>`
        );

        $.each($rows, function (i, o) {
            var itm = document.createElement("item");
            $chan.append(itm);
            var ttl = document.createElement("title");
            itm.appendChild(ttl);
            ttl.textContent = o.getAttribute("data-episode-name");
            var enc = document.createElement("enclosure");
            enc.setAttribute("url", o.getAttribute("data-play-uri"));
            itm.appendChild(enc);
            var summary = document.createElement("itunes:summary"); // <itunes:summary></itunes:summary>" +
            summary.textContent = "";
            itm.appendChild(summary);
            var pdat = document.createElement("pubDate");
            pdat.textContent =
                o.querySelector("time.date").textContent.replace(/[.]/g, "-") +
                "T00:00:00.000Z";
            itm.appendChild(pdat);
            var dura = document.createElement("itunes:duration");
            dura.textContent = o.querySelector("time.playTime").textContent.trim();
            itm.appendChild(dura);
        });
        console.info(
            "converted rss from podty",
            $.parseXML($ndata[0].outerHTML.replace(/&nbsp;/gi, " "))
        );
        return $.parseXML($ndata[0].outerHTML.replace(/&nbsp;/gi, " "));
    }

    static convertPodBbangHTMLToRSS(jsonDat) {
        //var ns_itunes = "http://www.itunes.com/dtds/podcast-1.0.dtd";
        //var $ndata = $(`<rss xmlns:itunes="${ns_itunes}" xmlns:media="http://search.yahoo.com/mrss/" xmlns:feedburner="http://rssnamespace.org/feedburner/ext/1.0" version="2.0"><channel></channel></rss>`);
        var $ndata = DakchoV4_Utils.getRSSNode();
        var $chan = $ndata.find("channel");
        $chan.append(`<title>${jsonDat.name}</title>`);
        var artist = jsonDat.name;
        $chan.append(`<itunes:author>${artist}</itunes:author>`);
        $chan.append(`<itunes:image href='${jsonDat.image}'/>`);
        $chan.append("<itunes:summary></itunes:summary>");
        for (var k in jsonDat.episodes) {
            var o = jsonDat.episodes[k];
            var itm = document.createElement("item");
            $chan.append(itm);
            var ttl = document.createElement("title");
            itm.appendChild(ttl);
            ttl.textContent = o.title;
            var enc = document.createElement("enclosure");
            enc.setAttribute("url", o.down_file);
            itm.appendChild(enc);
            var summary = document.createElement("itunes:summary"); // <itunes:summary></itunes:summary>" +
            summary.textContent = "";
            itm.appendChild(summary);
            var pdat = document.createElement("pubDate");
            var pday =
                o.pubdate.substring(0, 4) +
                "-" +
                o.pubdate.substring(4, 6) +
                "-" +
                o.pubdate.substring(6, 8);
            pdat.textContent = pday;
            itm.appendChild(pdat);
            var dura = document.createElement("itunes:duration");
            dura.textContent = null; //o.querySelector("time.playTime").textContent.trim();
            itm.appendChild(dura);
        }
        console.info(
            "converted rss from podbbang",
            $.parseXML($ndata[0].outerHTML.replace(/&nbsp;/gi, " "))
        );
        return $.parseXML($ndata[0].outerHTML.replace(/&nbsp;/gi, " "));
    }

    static convertHTMLToRSS(dat) {
        var $dat = $(dat);
        var $ndata = DakchoV4_Utils.getRSSNode();
        //var ns_itunes = "http://www.itunes.com/dtds/podcast-1.0.dtd";
        //var $ndata = $(`<rss xmlns:itunes="${ns_itunes}" xmlns:media="http://search.yahoo.com/mrss/" xmlns:feedburner="http://rssnamespace.org/feedburner/ext/1.0" version="2.0"><channel></channel></rss>`);
        var $chan = $ndata.find("channel");
        $chan.append(`<title>${$dat.find("div#content h1").text()}</title>`);
        var artist = $dat.find("div#title h2").text();
        artist = artist.substring(0, artist.lastIndexOf(" "));
        $chan.append(`<itunes:author>${artist}</itunes:author>`);
        if ($dat.find("div#left-stack div.artwork img").length > 0)
            $chan.append(
                `<itunes:image href='${$dat
          .find("div#left-stack div.artwork img")[0]
          .getAttribute("src-swap")}'/>`
            );
        $chan.append(
            `<itunes:summary>${$dat
        .find("div.product-review p")
        .text()}</itunes:summary>`
        );
        var $rows = $dat.find("tr.podcast-episode");

        $.each($rows, function (i, o) {
            var itm = document.createElement("item");
            $chan.append(itm);
            var ttl = document.createElement("title");
            itm.appendChild(ttl);
            ttl.textContent = o.getAttribute("preview-title");
            var enc = document.createElement("enclosure");
            enc.setAttribute("url", o.getAttribute("audio-preview-url"));
            itm.appendChild(enc);
            var summary = document.createElement("itunes:summary"); // <itunes:summary></itunes:summary>" +
            summary.textContent = o.querySelector("span.text").textContent;
            itm.appendChild(summary);
            var pdat = document.createElement("pubDate");
            pdat.textContent = o
                .querySelector("td.release-date")
                .getAttribute("sort-value");
            itm.appendChild(pdat);
            var dura = document.createElement("itunes:duration");
            dura.textContent = DakchoV4_Player.showTime(
                o.getAttribute("preview-duration")
            );
            itm.appendChild(dura);
        });
        return $.parseXML($ndata[0].outerHTML.replace(/&nbsp;/gi, " "));
    }

    static getTextFromXMLNode(node, ndName) {
        if (!node.documentElement && node.nodeType != 1) {
            return "";
        }
        if (node.documentElement) {
            node = node.documentElement;
        }
        if (ndName.indexOf("@") > -1) {
            var nodes = ndName.split("@");
            var tnode = node.querySelector(nodes[0]);
            return tnode == null ?
                "" :
                tnode.getAttribute(nodes[1]) == null ?
                "" :
                tnode.getAttribute(nodes[1]);
        }
        var tnode = node.querySelector(ndName);
        return tnode == null ? "" : tnode.textContent;
    }

    static getAllNodes(node, ndName) {
        if (!node.documentElement && node.nodeType != 1) {
            return "";
        }
        if (node.documentElement) {
            node = node.documentElement;
        }
        return node.getElementsByTagName(ndName);
    }

    static loadURL(uri) {
        return $.ajax({
            url: "/php/util/fetchURL.php",
            method: "GET",
            data: {
                uri: uri,
                dataType: "xml"
            }
        });
    }

    static parseQueryString() {
        var query = location.search.substr(1);
        var result = {};
        query.split("&").forEach(function (part) {
            var item = part.split("=");
            result[item[0]] = decodeURIComponent(item[1]);
        });
        return result;
    }

    static copyText(val) {
        $("#tmpInput").remove();
        var dummy = $('<input id="tmpInput">')
            .val(val)
            .appendTo("body")
            .select();
        document.execCommand("copy");
    }

    static removeDupJsonEntry(jsonDir, key) {
        var jsonCln = [],
            keyVals = [];
        $.each(jsonDir, function (i, o) {
            if ($.inArray(o[key], keyVals) == -1) {
                keyVals.push(o[key]);
                jsonCln.push(o);
            } else {}
        });
        return jsonCln;
    }

    static getItemsWithKeyValFromJsonArray(jsonDat, key, val) {
        return jsonDat.filter(item => jsonDat[key] == val);
    }
}