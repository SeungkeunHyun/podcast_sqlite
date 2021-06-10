/*jshint esversion: 6 */
class PageIndex {
  constructor() {
    this.tie = new TIE();
    this.dic = {};
  }
  static defaultFont() {
    if (localStorage.getItem("defaultFont"))
      return localStorage.getItem("defaultFont");
    return "Nanum Brush Script";
  }

  async init() {
    var self = this;
    await self.tie.init();
    await self.loadTemplate(self, "templates/tpl_podcast.html");
    self.loadData(self);
    self.addSearchFeature(self);
  }

  addSearchFeature(self) {
    var $ipt = $("#iptSearch");
    var $btn = $("#btnSearch");
    var searchTargets = [
      "https://itunes.apple.com/search",
      "http://www.podbbang.com/category/lists",
      "https://www.podty.me/search/total"
    ];
    $ipt.on("keydown", function (e) {
      if ($ipt.val().length > 0) {
        $btn.removeClass("disabled");
      } else {
        $btn.addClass("disabled");
      }
      if (e.charCode == 13) {
        $btn.trigger("click");
      }
    });
    $ipt.on("change", function (e) {
      if ($ipt.val().length > 0) {
        $btn.removeClass("disabled");
      } else {
        $btn.addClass("disabled");
      }
    });
    $btn.on("click", async function (e) {
      var srchWord = $ipt.val();
      var results = [];
      for (var url of searchTargets) {
        await self.searchResults(url, srchWord, results);
      }
      $("div.modal").remove();
      var htmlModal = await self.tie.loadFile(
        "templates/tpl_modal_podcast.html"
      );
      $("body").append(htmlModal.response);
      $("div.modal h5.modal-title").text("Search results: " + srchWord);
      $("div.modal #author").text("통합검색");
      $("div.modal div.media img").attr(
        "src",
        "https://png.icons8.com/metro/1600/search.png"
      );
      $("div.modal div.media img").attr("width", "60px");
      var mainData = $("#tabPodcasts")
        .DataTable()
        .data();
      for (var i = 0; i < results.length; i++) {
        results[i].registered = false;
        for (var j = 0; j < mainData.length; j++) {
          results[i].registered = results[i].url == mainData[j].url;
          if (results[i].registered) {
            break;
          }
        }
      }
      var $mdt = $("#tabModalList").DataTable({
        data: results,
        responsive: true,
        paging: false,
        columns: [{
            data: "site",
            title: "Site"
          },
          {
            data: "name",
            title: "Title",
            render: function (val, typ, row, meta) {
              return `<div class='media'>
                            <div class='media-left'><img src='${
                              row.image
                            }' class='media-object rounded' style='width:60px'></div>
                            <div class='media-body'><h5 class='media-heading' style=\"font-family: '${PageIndex.defaultFont()}', cursive;\"> ${val}</h5><p class='pSummary'>${
                !row.registered
                  ? "<button class='fa fa-plus-square'>Add to My</button>"
                  : " registered in main "
              }</p></div>
                            </div>`;
            }
          }
        ]
      });
      $("button.fa-plus-square").on("click", async function (e) {
        var rowToAdd = $mdt.row($(this).closest("tr")).data();
		rowToAdd.cast_episode = 'cast';
		rowToAdd.provider = rowToAdd.site.toLowerCase();
		delete rowToAdd.site;
        LocalStorageUtil.registerLocalStorage("myCasts", "url", rowToAdd);
        await self.loadRSS(rowToAdd, self);
        $("#tabPodcasts")
          .DataTable()
          .row.add(rowToAdd)
          .draw();
        $(this).remove();
      });
      $("div.modal").modal();
    });
  }

  async searchResults(url, srchWord, results) {
    if (url.indexOf("apple") > -1) {
      var resp = await $.ajax({
        url: url,
        data: {
          term: srchWord
        }
      });
      var resp = JSON.parse(resp);
      if (resp.resultCount > 0) {
        resp.results.forEach(function (itm) {
          var item = {};
          item.podcastID = itm.collectionId;
          item.name = itm.trackName;
          item.url = itm.feedUrl;
          item.image = itm.artworkUrl100;
          item.category = "My";
          item.site = "iTunes";
          results.push(item);
        });
      }
    } else if (url.indexOf("podbbang") > 0) {
      var resp = await $.ajax({
        url: "https://phpfetch.herokuapp.com/php/util/fetchURL.php",
        data: {
          uri: url + "?keyword=" + encodeURI(srchWord)
        }
      });
      var $items = $(resp).find("#podcast_list ul.clearfix");
      $.each($items, function (i, o) {
        var item = {};
        var pid = o
          .querySelector("a")
          .getAttribute("href")
          .substring(4);
        item.name = o.querySelector("dt a").textContent;
        item.url =
          "http://www.podbbang.com/podbbangchnew/episode_list?id=" +
          pid +
          "&page=1&e=&sort=&page_view=&keyword=";
        item.podcastID = pid;
        item.image = o.querySelector("img").getAttribute("src");
        item.category = "My";
        item.site = "팥빵";
        results.push(item);
      });
    } else {
      var resp = await $.ajax({
        url: "/php/util/fetchURL.php?uri=" + url + "?keyword=" + encodeURI(srchWord)
      });
      var $items = $(resp).find("#castResults li");
      $.each($items, function (i, o) {
        var item = {};
        item.name = o.querySelector("a.name").textContent;
        item.url =
          "https://www.podty.me" +
          o.querySelector("a.name").getAttribute("href");
        item.podcastID = o
          .querySelector("a.name")
          .getAttribute("href")
          .split("/")[1];
        item.image = o.querySelector("img").getAttribute("src");
        item.category = "My";
        item.site = "Podty";
        results.push(item);
      });
    }
  }

  getTitle(val, row) {
    var itemCount = val;
    if (row.xdoc) {
      itemCount = `${val} <span class='badge badge-pill badge-dark'>${
        row.xdoc.querySelectorAll("item").length
      }</span>`;
    }
    return itemCount;
  }

  getCategory(val, row) {
    if (row.site && row.site == "iTunes") {
      return val + " <i class='fa fa-music small'></i>";
    }
    return `${val} ${
      row.site && row.site == "Podty"
        ? "<kbd class='small' title='Podty' style='font-size:8pt'>Podty</kbd>"
        : "<img title='팟빵' src='http://img.podbbang.com/img/h2/podbbang/podbbang6.ico' width='15px'/>"
    }`;
  }

  getTabPCColDefs(jsonPC, self) {
    var cols = [];
    var row = jsonPC[0];
    for (var k in row) {
      var col = {
        data: k,
        title: k
      };
      switch (k) {
        case "category":
          col.title = "Category";
          col.render = function (val, typ, row, meta) {
            return `<kbd style=\"font-family: '${PageIndex.defaultFont()}', cursive;\">${self.getCategory(
              val,
              row
            )}</kbd>`;
          };
          break;
        case "name":
          col.render = function (val, typ, row, meta) {
            return `<div class='media'>
                            <div class='media-left'><img src='${
                              row.image
                            }' class='media-object rounded' style='width:60px'></div>
                            <div class='media-body'><h5 class='media-heading' style=\"font-family: '${PageIndex.defaultFont()}', cursive;\"> ${self.getTitle(
              row.name,
              row
            )} <p class='pSummary'></p></div>
                            </div>`;
          };
          col.title = "Podcast";
          break;
        case "lastPub":
          col.render = function (val, typ, row, meta) {
            if (row.lastPub)
              return `<small class='lastPostedAt' style=\"font-family: 'Passion One', cursive;\">${row.lastPub
                .substring(2, 16)
                .replace(
                  "T",
                  " "
                )}</small><br><i class='fa fa-refresh' aria-hidden='true'></i>`;
            else 
				return `<i class='fa fa-refresh' aria-hidden='true'></i>`;
          };
          col.title = "Posted at";
          break;
        default:
          col.visible = false;
          break;
      }
      if (k == "category") {
        cols.splice(0, 0, col);
      } else {
        cols.push(col);
      }
    }
    return cols;
  }

  async loadData(self) {
    var jsonPC = await self.loadPodcastList();
    if (LocalStorageUtil.getItemArrayFromLocalStorage("myCasts")) {
      jsonPC = jsonPC.concat(
        LocalStorageUtil.getItemArrayFromLocalStorage("myCasts")
      );
    }
    jsonPC.forEach(function (itm) {
	  itm["cast_episode"] = 'cast';
      itm["lastPub"] = null;
      itm["xdoc"] = null;
    });
    var cols = self.getTabPCColDefs(jsonPC, self);
    var $tab = $("#tabPodcasts");
    var $dt = $tab.DataTable({
      data: jsonPC,
      columns: cols,
      paging: false,
      bInfo: false,
      responsive: true,
      colReorder: true,
      info: false
    });
    $("#divPodcasts div.dataTables_wrapper").addClass("small");
    $.fn.dataTable
      .tables({
        visible: true,
        api: true
      })
      .columns.adjust();
    document.querySelector("table.dataTable").style = {
      "border-collapse": "collapse",
      width: "100%"
    };
    $dt.colReorder.move(1, 0);
    $("#navbarBookmark").on("click", function (e) {
      var bookmarks = LocalStorageUtil.getItemArrayFromLocalStorage(
        "bookmarks"
      );
      if (!bookmarks) {
        return;
      }
      bookmarks.sort(function (a, b) {
        return b.recordedAt - a.recordedAt;
      });
      var $lstBM = $("#listBookmarks");
      $lstBM.empty();
      if (!bookmarks) {
        return;
      }
      bookmarks.forEach(function (itm) {
        var $item = $(
          '<a class="dropdown-item" href="#">[' +
          itm.title +
          "] " +
          itm.episode +
          "</a>"
        );
        $item.data(itm);
        $lstBM.append($item);
      });
      $lstBM.find("a").on("click", function () {
        var rec = $(this).data();
        self.playCast(rec, self, bookmarks);
        $("button.navbar-toggler").trigger("click");
      });
    });

    $("#navbarFonts").on("click", self.openFonts);

    $("footer").remove();
    $("body").append(
      '<footer class="container-fluid page-footer font-small stylish-color-dark pt-4 mt-4" style="width:100%;position:fixed;bottom:0"><div class="progress">' +
      '<div style="height:60px;vertical-align:middle" class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>' +
      "</div></footer>"
    );
	var $dt = $tab.DataTable();
	$tab.on(
      "click",
      "i.fa-refresh", {
        self: self,
        dt: $dt,
        $dt
      },
      self.refreshRecord
    );
    self.refreshPostData($dt, self);
    self.addDTEvents($tab, self);
  }

  openFonts(e) {
    var fonts = $("head link[href^='https://fonts.googleapis.com/css']")
      .attr("href")
      .split("=")[1]
      .split("|");
    var $lstFont = $("#listFonts");
    $lstFont.empty();
    if (!fonts) {
      return;
    }
    fonts.forEach(function (itm) {
      itm = itm.replace(/[+]/g, " ");
      var $item = $(
        '<a class="dropdown-item" style="font-family: ' +
        itm +
        ', cursive;" href="#">' +
        itm +
        "</a>"
      );
      $item.data(itm);
      $lstFont.append($item);
      $lstFont.find("a").on("click", function () {
        $("button.navbar-toggler").trigger("click");
        localStorage.setItem("defaultFont", this.textContent);
        $("h5[style^=font-family]").attr(
          "style",
          "font-family:'" + this.textContent + "', cursive;"
        );
        $("kbd[style^=font-family]").attr(
          "style",
          "font-family:'" + this.textContent + "', cursive;"
        );
      });
    });
  }

  async loadRSS(dat, self) {
    var key = CryptoJS.SHA256(dat.url).toString();
    dat["key"] = key;
    //dic[key] = "";
    if (
      dat.url.indexOf("podbbang") > -1 ||
      dat.url.indexOf("ssenhosting") > -1
    ) {
      var podbbangURL =
        "http://www.podbbang.com/podbbangchnew/episode_list?id=" +
        dat.podcastID +
        "&page=";
      dat.site = "Podbbang";
      var episode = {};
      for (var i = 1; i < 7; i++) {
        var doc = await $.ajax({
          url: "https://phpfetch.herokuapp.com/php/util/fetchURL.php",
          data: {
            uri: podbbangURL + i
          }
        });
        if (doc.indexOf("var episode_uids") == -1) {
          var episode_uids = [];
        }
        eval(
          doc.substring(
            doc.indexOf("var ischsell	= 'N';"),
            doc.indexOf("if(episode_uids")
          )
        );
      }
      dat.episodes = episode;
      var xdoc = DakchoV4_Utils.convertPodBbangHTMLToRSS(dat);
    } else if (dat.url.indexOf("www.podty.me") > -1) {
      dat.site = "Podty";
      var doc = await self.tie.loadFile("/php/util/fetchURL.php?uri=" + dat.url);
      var xdoc = DakchoV4_Utils.convertPodtyHTMLToRSS(doc.response);
    } else {
      dat.site = "iTunes";
      var doc = await self.tie.loadExternalFile(dat.url);
      var xdoc = $.parseXML(doc.response);
    }
    var srcImg = xdoc.querySelector("image").getAttribute("href");
    if (!srcImg) {
      srcImg = xdoc.querySelector("image url").textContent;
    }
    dat["image"] = srcImg;
    dat["xdoc"] = xdoc;
    var dt = self.getLatestPubDate(xdoc);
    dt.setHours(dt.getHours() + 9);
    dat["lastPub"] = dt.toISOString();
    //$row.invalidate();
  }

  setProgressPercentage(rcnt, rowsToRefresh, self) {
    var $pbar = $("div.progress-bar");
    var pct = parseInt(((rcnt - rowsToRefresh) / rcnt) * 100);
    $pbar.attr("style", `width: ${pct}%`);
    $pbar.attr("arial-valuenow", pct);
    $pbar.text(`Loading: ${pct}%`);
  }

  async refreshPostData($dt, self) {
    var serializer = new XMLSerializer();
    var dic = {};
    var rowsToRefresh = $dt.data().count();
    var rcnt = $dt.rows().count();
    $dt.rows().every(async function (rowIdx, tableLoop, rowLoop) {
      try {
        var $row = $dt.row(rowIdx);
        await self.loadRSS($row.data(), self);
        $row.invalidate();
      } catch (ex) {
        console.error(ex);
      } finally {
        self.setProgressPercentage(rcnt, rowsToRefresh--, self);
      }
      if (rowsToRefresh == 0) {
        self.postTableRefresh($dt, self);
        self.setDefaultResume(self);
      }
    });
  }

  postTableRefresh($dt, self) {
    $dt.order([5, "desc"]).draw();
    if (window.location.hash.length > 1) {
      var pcid = window.location.hash.substring(1);
      var rowsDat = $dt.data();
      for (var i = 0; i < rowsDat.length; i++) {
        if (rowsDat[i].podcastID == pcid) {
          var evt = new Event("pcid");
          evt.data = {};
          evt.data.self = self;
          evt.data.dat = rowsDat[i];
          self.showList(evt);
          break;
        }
      }
    }
  }

  setDefaultResume(self) {
    if ($("#player").length == 0) {
      var bookmarks = LocalStorageUtil.getItemArrayFromLocalStorage(
        "bookmarks"
      );
      $("footer").remove();
      if (bookmarks) {
        self.playCast(bookmarks[0], self, bookmarks, true);
      }
    }
  }

  getLatestPubDate(xdoc) {
    var items = xdoc.getElementsByTagName("item");
    if (items[0].querySelector("pubDate")) {
      var dt1 = new Date(items[0].querySelector("pubDate").textContent);
      var dt2 = new Date(
        items[items.length - 1].querySelector("pubDate").textContent
      );
    } else {
      var dt1 = new Date(items[0].querySelector("pubdate").textContent);
      var dt2 = new Date(
        items[items.length - 1].querySelector("pubdate").textContent
      );
    }
    return dt1 > dt2 ? dt1 : dt2;
  }

  addDTEvents($tab, self) {
    var $dt = $tab.DataTable();
    var dat = $dt.row(this).data();
	console.log(dat);
    $tab.on(
      "click",
      "h5", {
        self: self,
        dt: $dt
      },
      self.showList
    );
  }

  async refreshRecord(evt) {
    var $tr = $(this).closest("tr");
    var $dt = evt.data.dt;
    var self = evt.data.self;
    var $icon = $(this);
    $icon.addClass("fa-spin");
    await self.loadRSS($dt.row($tr).data(), self);
    $dt.row($tr).invalidate();
    $icon.removeClass("fa-spin");
  }

  mapRSSItemsToJSON(items, self) {
    var jsonItems = [];
    items.forEach(function (itm) {
      var jsonItem = {};
      jsonItem.episode = itm.querySelector("title").textContent;
      jsonItem.pubdate = itm.querySelector("pubdate") ?
        itm.querySelector("pubdate").textContent :
        itm.querySelector("pubDate").textContent;
      jsonItem.source = itm.querySelector("enclosure").getAttribute("url");
      if (itm.querySelector("summary"))
        jsonItem.summary = itm.querySelector("summary").textContent;
      if (itm.querySelector("duration")) {
        jsonItem.duration = itm.querySelector("duration").textContent;
      } else {
        jsonItem.duration = null;
      }
      jsonItems.push(jsonItem);
    });
    return jsonItems;
  }

  setDataTableRenderOption(self) {
    $.fn.dataTable
      .tables({
        visible: true,
        api: true
      })
      .columns.adjust();
    document.querySelector("table.dataTable").style = {
      "border-collapse": "collapse",
      width: "100%"
    };
    $("div.modal div.dataTables_wrapper").addClass("small");
  }

  async showList(evt) {
    var self = evt.data.self;
    if (evt.type == "pcid") {
      var dat = evt.data.dat;
    } else {
      var dat = evt.data.dt.row($(evt.currentTarget).closest("tr")).data();
    }
    $("div.modal").remove();
    var htmlModal = await self.tie.loadFile("templates/tpl_modal_podcast.html");
    $("body").append(htmlModal.response);
    $("div.modal h5.modal-title").text(dat.name);
    $("div.modal div.media img").attr("src", dat.image);
    $("div.modal #author").text(dat.xdoc.querySelector("author").textContent);
    $("div.modal #pcSummary").text(
      dat.xdoc.querySelector("summary").textContent
    );
    var items = dat.xdoc.querySelectorAll("item");
    var jsonItems = self.mapRSSItemsToJSON(items, self);
    jsonItems.sort(function (a, b) {
      return new Date(b.pubdate) - new Date(a.pubdate);
    });
    var $modalTab = $("div.modal table#tabModalList");
    var $mdt = $modalTab.DataTable({
      destroy: true,
      data: jsonItems,
      columns: self.getPCListColDefs(),
      //fixedHeader: true,
      paging: false,
      responsive: true,
      info: false,
      bInfo: false,
      order: [
        [1, "desc"]
      ]
    });
    self.setDataTableRenderOption(self);
    $modalTab.on("click", "td", function (evt) {
      var toPlay = $(this).has("i.fa-play-circle").length;
      var dat = $mdt.row(this).data();
      var rec = {};
      rec.title = $("h5.modal-title").text();
      rec.image = $("div.modal-header img").attr("src");
      rec.author = $("#author").text();
      rec.episode = dat.episode;
      rec.currentTime = 0;
      rec.source = dat.source;
      rec.summary = dat.summary;
      if (toPlay) {
        self.playCast(rec, self, jsonItems);
        $("div.modal").modal("toggle");
      } else {
        self.downloadFile(rec, self);
      }
    });
    $("div.modal").modal("toggle");
    $mdt.columns.adjust();
  }

  downloadFile(rec, self) {
    var dat = {
      lnk: encodeURI(rec.source),
      img: encodeURI(rec.image),
      artist: rec.author,
      ttl: rec.title,
      title: rec.episode,
      summary: rec.summary
    };
    $.download("/php/util/encodeID3Download.php", dat, "dlFrame");
    /*
        if (typeof (io) === "function" && dat.ttl.indexOf("뉴스관장") > -1) {
            var socket = io('http://localhost:3000');
            socket.emit('id3write', dat);
            console.log(socket, dat);
            socket.on("received", function (dat) {
                console.log(dat);
                socket.close();
            });

        } else {
            $.download("/php/util/getid3_download.php", dat, "dlFrame");
        }
        */
  }

  setPlayerFooter(rec, isDefault, self) {
    var player = document.querySelector("#mplayer");
    if (player && player.duration > 0 && !player.paused) {
      player.pause();
    }
    var $div = $("footer");
    var mtype =
      rec.source.toLowerCase().indexOf(".mp3") > -1 ? "audio" : "video";
    $div.remove();
    $div = $(`<footer class='container-fluid page-footer font-small stylish-color-dark pt-4 mt-4' style='width:100%;position:fixed;bottom:0'>
            <div class='row'><div class='text-md-left media col-md-6'><div class='media-left'><img class='rounded' src='${
              rec.image
            }' width='60px'></div>
            <div class='media-body'><strong>${
              rec.title
            }</strong><br/><small class='col-md-6'>${
      rec.episode
    }</small></div></div>
            <div class='col-md-6 text-center' style='padding:0px'>
            <div>
            <${mtype} id='mplayer' style='width:100%' controls><source src='${
      rec.source
    }'></${mtype}>
            </div>
            <div class='btn-group btn-group-justified align-center' id='divBtnControllers'>
            <button type='button' id='btnPrev' class='btn btn-sm btn-primary'><i class='fa fa-fast-backward'></i></button>
            <button type='button' id='btn30b' class='btn btn-sm btn-primary'><i class='fa fa-backward'></i></button>
            <button type='button' id='btnPP' class='btn btn-sm btn-primary'><i class='fa fa-pause'></i></button>
            <button type='button' id='btn30f' class='btn btn-sm btn-primary'><i class='fa fa-forward'></i></button>
            <button type='button' id='btnNext' class='btn btn-sm btn-primary'><i class='fa fa-fast-forward'></i></button>
            <select id='selPlist' data-live-search='true' class='selectpicker show-tick input-sm' style='background-color:gray'>
            </select>
            </div></div></footer>`);
    $("body").append($div);
    player = document.querySelector("#mplayer");
    $(player).data(rec);
    player.load();
    $div.find("#divBtnControllers").on("click", "button", self.setControllers);
    $div.find("button.dropdown-toggle").addClass("btn-sm");
    if (rec.currentTime) {
      if (!!navigator.platform.match(/iPhone|iPod|iPad/)) {
        player.currentSrc += "#t=" + rec.currentTime;
      } else {
        player.currentTime = rec.currentTime;
      }
    }
    if (!isDefault) {
      player.play();
    }
    self.addEvents(player, self);
  }

  setPlayList(plist, rec, self) {
    var $divPlist = $("#selPlist");
    plist.forEach(function (itm) {
      var $item = $(
        `<option title='${itm.episode}'>${
          itm.episode.length > 20
            ? itm.episode.substring(0, 17) + "..."
            : itm.episode
        }</option>`
      );
      if (itm.source == rec.source) {
        $item.attr("selected", true);
      }
      $item.data(itm);
      $divPlist.append($item);
    });
    $divPlist.on("click", "option", function () {
      self.playCast($(this).data(), self, plist);
    });
    $divPlist.on("change", function (e) {
      var rec = $(this[this.selectedIndex]).data();
      self.playCast(rec, self, plist);
    });
    var $bsSel = $divPlist.selectpicker({
      style: "btn-primary",
      size: 4
    });
  }

  playCast(rec, self, plist, isDefault) {
    if (plist && plist.length > 0) {
      if (!plist[0].hasOwnProperty("image")) {
        plist.forEach(function (itm) {
          itm.title = rec.title;
          itm.image = rec.image;
        });
      }
    }
    self.setPlayerFooter(rec, isDefault, self);
    self.setPlayList(plist, rec, self);
    if (!rec.currentTime &&
      LocalStorageUtil.getItemFromLocalStorage(
        "bookmarks",
        "source",
        rec.source
      )
    ) {
      var item = LocalStorageUtil.getItemFromLocalStorage(
        "bookmarks",
        "source",
        rec.source
      );
      rec.currentTime = item.currentTime;
    }
    $("ul.dropdown-menu li").addClass("small");
    $("body").css("margin-bottom", $("footer").height());
  }

  setControllers() {
    var player = document.querySelector("#mplayer");
    var $btn = $(this);
    var sel = document.querySelector("#selPlist");
    switch (this.id) {
      case "btnPrev":
        sel.selectedIndex =
          sel.selectedIndex < sel.options.length - 1 ?
          sel.selectedIndex + 1 :
          sel.selectedIndex;
        $(sel).trigger("change");
        break;
      case "btn30b":
        player.currentTime -= player.currentTime < 30 ? 0 : 30;
        break;
      case "btn30f":
        player.currentTime += 30;
        break;
      case "btnPP":
        if (player.paused) {
          player.play();
        } else {
          player.pause();
        }
        break;
      case "btnNext":
        sel.selectedIndex =
          sel.selectedIndex > 0 ? sel.selectedIndex - 1 : sel.selectedIndex;
        $(sel).trigger("change");
        break;
    }
  }

  addEvents(player, self) {
    player.addEventListener("abort", self.recordBookmark);
    player.addEventListener("error", self.recordBookmark);
    player.addEventListener("pause", self.recordBookmark);
    player.addEventListener("play", function () {
      var icon = $("#btnPP i");
      if (icon.hasClass("fa-play")) {
        icon.removeClass("fa-play");
        icon.addClass("fa-pause");
      }
    });
    player.addEventListener("ended", self.goNext);
  }

  goNext() {
    var sel = document.querySelector("#selPlist");
    LocalStorageUtil.removeItemFromLocalStorage(
      "bookmarks",
      "source",
      this.currentSrc
    );
    if (sel.selectedIndex) {
      $("#btnNext").trigger("click");
    }
  }

  recordBookmark() {
    var icon = $("#btnPP i");
    if (icon.hasClass("fa-pause")) {
      icon.removeClass("fa-pause");
      icon.addClass("fa-play");
    }
    var rec = {};
    var footer = document.querySelector("footer");
    rec.image = footer.querySelector("img").getAttribute("src");
    rec.title = footer.querySelector("strong").textContent;
    rec.episode = footer.querySelector("small").textContent;
    rec.currentTime = this.currentTime;
    rec.source = this.currentSrc;
    var bookmarks = LocalStorageUtil.getItemArrayFromLocalStorage("bookmarks");
    rec.recordedAt = new Date().getTime();
    LocalStorageUtil.registerLocalStorage("bookmarks", "source", rec);
  }

  getPCListColDefs() {
    return [{
        data: "episode",
        title: "episode",
        render: function (val, typ, row, meta) {
          return `<div class='media'>
                    <div class='media-body' style='width:250px;overflow-x:auto'>
                      <i class='fa fa-play-circle'></i>
                      <strong class='mt-0' style=\"font-family: '${PageIndex.defaultFont()}', cursive;\">${val}</strong>
                      <p>
                      <small>${
                        row.summary ? row.summary : ""
                      }</small>
                      </p>
                    </div>
                  </div>`;
        }
      },
      {
        data: "pubdate",
        title: "posted at",
        render: function (val, typ, row, meta) {
          var dt = new Date(val);
          dt.setHours(dt.getHours() + 9);
          var strDT = dt.toISOString();
          return `<i class='fa fa-download'></i> <small style=\"font-family: 'Passion One', cursive;\">${strDT.substring(
            2,
            10
          )}<br/>${strDT.substring(11, 16)}</small>`;
        }
      }
    ];
  }

  loadPodcastList() {
    console.info("starting to load podcasts");
    return new Promise((resolve, reject) => {
      $.getJSON("json/podcastlist.json?q=" + new Date().getTime())
        .then(dat => resolve(dat))
        .catch(e => reject(e));
    });
  }

  async loadTemplate(self, src) {
    var objReq = await self.tie.loadFile(src);
    if (objReq) {
      var $body = $("body");
      $body.empty();
      $body.append(objReq.responseText);
    }
  }
}

var pgi = new PageIndex();
pgi.init();