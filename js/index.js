class QuickPlayer {
	uri_vcast = '/php/rest-sqlite/index.php/v_casts';
	uri_casts = '/php/rest-sqlite/index.php/casts';
	uri_episodes = '/php/rest-sqlite/index.php/episodes';
	ituns_ns = 'http://www.itunes.com/dtds/podcast-1.0.dtd';
	mainTab = null;
	episodeTab = null;
	player = null;
	casts = [];
	updatedCasts = [];
	herokuFetcher = 'https://phpfetch.herokuapp.com/fetchURL.php';
	constructor() {

	}

	init() {
		fetch(this.uri_vcast)
		.then(res => {
			if(res.ok) {
				return res.json();
			}
		})
		.then( async(data) => {
			this.casts = data;
			await this.initializeUI();
			$('#spinner').hide();
		}).catch(ex => {
			console.error(ex);
		});
		$("#po-bookmarks").on('click', (e) => {
			this.renderBookmarks($('#popCast'));
		});
		$("#popCast").on('hidden.bs.modal', function () {
			$(this).data('bs.modal', null);
		});
	}

	async initializeUI() {
		let dtOptions = QPHelper.getDTOptionsTemplate();
		dtOptions.data = this.casts;
		dtOptions.paging = false;
		dtOptions.scrollY = window.innerHeight - 250, //$('body').height() - $('.dataTables_scrollBody').height(),
		dtOptions.sDom = '<"search-box"r>lftip',
		dtOptions.columnDefs = [{ responsivePriority: 1, targets: 2 }, { responsivePriority: 2, targets: 3 }];
		dtOptions.columns = QPHelper.columnsCast;
		dtOptions.order = [3, 'desc'];
		this.mainTab = $("#tabCasts").DataTable(dtOptions);
		this.mainTab.columns.adjust().responsive.recalc();
		this.addEvents();
		await this.fetchEpisodes();
		console.log('updated casts', this.updatedCasts);
		this.casts = this.casts.filter(i => !this.updatedCasts.includes(i.podcastID));
		for(var c of this.updatedCasts) {
			const updCast = await this.fetchCast(c);
			this.casts.push(updCast);
		}
		if(this.updatedCasts.length) {
			this.mainTab.clear();
			this.mainTab.rows.add(this.casts).draw();
		}
	}

	async fetchCast(castID) {
		const reqURI = this.uri_vcast + '/podcastID/' + castID;
		console.log('cast to refresh', reqURI);
		const res = await fetch(reqURI);
		const recs = await res.json();
		return recs[0];
	}

	getFetchURL(cast) {
		switch(cast.provider) {
			case 'podbbang':
				return 'http://www.podbbang.com/podbbangchnew/episode_list?id=' + cast.podcastID;
				break;
			case 'podty':
				return 'https://www.podty.me/cast/' + cast.podcastID;
				break;
			default:
				return cast.feedURL;
		}
	}

	async fetchEpisodes() {
		await Promise.all(
			this.casts.map(async cast => {
				const failCount = await this.refreshEpisode(cast);
				//console.log('episode loading result', cast, failCount);
		}));
	}

	async refreshEpisode(cast) {
		const fetchURL = this.getFetchURL(cast);
		//console.log(c, c.feedURL);
		const data = await $.ajax({
			url: this.herokuFetcher,
			data: { uri: fetchURL },
			dataType: cast.provider == 'itunes' ? 'xml' : 'html'
		});
		let episodes = await this.parseEpisodes(cast, data);
		let done = false;
		let failCount = 0;
		for (let itm of episodes) {
			if(failCount > 1) {
				break;
			}
			itm.cast_episode = cast.podcastID;
			try {
				let res = await fetch(this.uri_episodes, {
					method: "POST",
					mode: 'cors', // no-cors, *cors, same-origin
					cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
					credentials: 'same-origin', // include, *same-origin, omit
					headers: {
						'Content-Type': 'application/json'
						// 'Content-Type': 'application/x-www-form-urlencoded',
					},
					redirect: 'follow', // manual, *follow, error
					referrer: 'no-referrer', // no-referrer, *client
					body: JSON.stringify(itm)
				});
				res = await res.json();
				if (res.hasOwnProperty('error')) {
					failCount++;
					//console.error('error in posting', res, itm);
					if (episodes.length > 15 || failCount > 1) {
						break;
					}
				} else if (this.updatedCasts.indexOf(cast.podcastID) == -1) {
					this.updatedCasts.push(cast.podcastID);
					//console.log('posting result', res, itm);
				}
			} catch (res) {
				failCount++;
				console.error(itm, res);
				break;
			}
		}
		return failCount;
	}

	async parseEpisodes(cast, src) {
		let $el = null;
		const episodes = [];
		let recCast = JSON.parse(JSON.stringify(cast));
		recCast.cast_episode = null;
		delete recCast.lastPubAt;
		delete recCast.episodes;
		let ep = null;
		switch(cast.provider) {
			case 'podbbang':
				const data = await $.ajax({
					url: this.herokuFetcher,
					data: { uri: 'http://podbbang.com/ch/' + cast.podcastID },
					dataType: cast.provider == 'itunes' ? 'xml' : 'html'
				});
				const $dat = $(data);
				recCast.name = $dat.find('#all_title p')[0].textContent.trim();
				recCast.summary = $dat.find('#podcast_summary').attr('title');
				recCast.imageURL = $dat.find('#podcast_thumb img').attr('src').replace(/\?.+$/, '');
				recCast.author = recCast.name;
				const scriptStart = "var ischsell";
				const scriptEnd = "if(episode_uids";
				const strSrc = src + "";
				const scriptBody = src.substring(src.indexOf(scriptStart), src.indexOf(scriptEnd, src.indexOf(scriptStart)));
				let episode = {};
				let episode_uids = [];
				eval(scriptBody);
				Object.keys(episode).forEach((key) => {
					//console.log(key, episode[key]);
					ep = {};
					ep.mediaURL = episode[key].down_file;
					ep.title = episode[key].title;
					ep.pubDate = moment(episode[key].pubdate, 'YYYYMMDD').format('YYYY-MM-DD');
					episodes.push(ep);
				});
				break;
			case 'podty':
				$el = $(src);
				recCast.name = $el.filter('title').text().trim();
				recCast.summary = $el.find('div.intro p')[0].textContent.trim();
				recCast.imageURL = $el.find('div.thumbnail img').attr('src').trim();
				recCast.feedURL = $el.find('li.btnCopyRSS').attr('data-clipboard-text').trim();
				recCast.author = $el.find('ul.subInfo li')[0].querySelector('strong').textContent.trim();
				$.each($el.find('div.not_mine ul li'), function(i, o) {
					ep = {};
					ep.mediaURL = o.getAttribute('data-play-uri');
					ep.title = o.getAttribute('data-episode-name');
					ep.pubDate = o.querySelector('div.episodeInfo time.date') == null ? null : o.querySelector('div.episodeInfo time.date').textContent.replace(/\./g, '-');
					ep.duration = o.querySelector('div.episodeInfo time.playTime') == null ? null : o.querySelector('div.episodeInfo time.playTime').textContent.trim();
					episodes.push(ep);
				});
				break;
			default:
				recCast.name = src.querySelector('rss channel title').textContent.trim();
				recCast.summary = src.querySelector('rss channel description').textContent.trim();
				recCast.author = src.querySelector('rss channel author').textContent.trim();
				recCast.imageURL = src.querySelector('rss channel image[href]').getAttribute('href');
				src.querySelectorAll('item').forEach(itm => {
					ep = {};
					ep.title = itm.querySelector("title").textContent.trim();
					ep.pubDate = new Date(itm.querySelector("pubDate").textContent).toISOString();
					ep.mediaURL = itm.querySelector("enclosure").getAttribute("url");
					if (itm.querySelector("summary"))
						ep.summary = itm.querySelector("summary").textContent.trim();
					if (itm.querySelector("duration")) {
						ep.duration = itm.querySelector("duration").textContent.trim();
					} else {
						ep.duration = null;
					}
					episodes.push(ep);
				});
				break;
		}
		for(let k in recCast) {
			if(cast.hasOwnProperty(k) && cast[k] !== recCast[k]) {
				console.log(k, "prev", cast[k], "current", recCast[k])
				const reqURL = this.uri_casts + '/' + recCast.podcastID;
				fetch(reqURL, {
					method: "PUT",
					mode: 'cors', // no-cors, *cors, same-origin
					cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
					credentials: 'same-origin', // include, *same-origin, omit
					headers: {
						'Content-Type': 'application/json'
						//'Content-Type': 'application/x-www-form-urlencoded'
					},
					redirect: 'follow', // manual, *follow, error
					referrer: 'no-referrer', // no-referrer, *client
					body: JSON.stringify(recCast)
				}).then(res => {
					 if(res.ok) 
						return res.json();
				})
				.then(resp => {
					if(!this.updatedCasts.includes(recCast.podcastID)) {
						this.updatedCasts.push(recCast.podcastID);
					}
					console.log(reqURL, recCast, resp)
				});
				break;
			}
		}
		return episodes.sort((a,b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
	}

	addEvents() {
		this.mainTab.on('click', 'tbody tr td h5.media-heading,tbody tr td small', (e) => {
			const row = e.currentTarget.closest('tr');
			$('#spinner_modal').hide();
			this.renderCast(this.mainTab.row(row).data(), $("#popCast"));
		});
		this.mainTab.on('click', 'tbody tr td svg.fa-sync-alt', async (e) => {
			const row = e.currentTarget.closest('tr');
			const $icon = $(e.currentTarget);
			$icon.addClass('fa-spin');
			const cdat = this.mainTab.row(row).data();
			await this.refreshEpisode(cdat);
			const refdat = await this.fetchCast(cdat.podcastID);
			console.log('refreshed cast', refdat);
			this.mainTab.row(row).data(refdat);
			$icon.removeClass('fa-spin');
		});
		this.mainTab.on('click', 'tbody tr td div.media-footer a', async (e) => {
			const $srchBtn = $(e.currentTarget);
			let colno = parseInt($srchBtn.attr('data-colno'));
			const srchWord = $srchBtn.text();
			if ($(`div.dataTables_filter label a:contains('${srchWord}')`).length) {
				return;
			}
			this.mainTab.column(colno).search('').draw();
			let $srchTag = $srchBtn.clone();
			$srchTag.addClass('m-3');
			$srchTag.append("<i class='fas fa-times m-1'></i>");
			$srchTag.on('click', (e) => {
				colno = parseInt(e.currentTarget.getAttribute('data-colno'));
				this.mainTab.column(colno).search('').draw();
				e.currentTarget.remove();
			});
			$("div.dataTables_filter label").prepend($srchTag);
			this.mainTab.column(colno).search(srchWord).draw();
		});
		this.player = document.getElementById('player');
		$('div.btn-group button').on('click', e => {
			const btn = e.currentTarget.querySelector('svg');
			//console.log(btn);
			if (btn.classList.contains('fa-play')) {
				this.player.play();
				return;
			}
			if (btn.classList.contains('fa-forward')) {
				this.player.currentTime += 30;
				return;
			}
			if (btn.classList.contains('fa-backward')) {
				this.player.currentTime -= 30;
				return;
			}
			if (btn.classList.contains('fa-pause')) {
				this.player.pause();
				return;
			}
			if (btn.classList.contains('fa-download')) {
				const ep = $(this.player).data('episode');
				const cast = $(this.player).data('cast');
				QuickPlayer.download(cast, ep);
				return;
			}
		});
		this.player.onplay = e => {
			QuickPlayer.iconToggle(true);
			$("#playerToggler").addClass('blink_me');
		};
		this.player.onabort= e => {
			$("#playerToggler").removeClass('blink_me');
			QuickPlayer.iconToggle(false);
		};
		this.player.onpause = e => {
			$("#playerToggler").removeClass('blink_me');
			QuickPlayer.iconToggle(false);
			this.recordCurrent(true);
		};
		this.player.onended = e => {
			$("#playerToggler").removeClass('blink_me');
			QuickPlayer.iconToggle(false);
			this.recordCurrent(false);
		}

		this.player.ontimeupdate = e=> {
			if(isNaN(this.player.duration)) {
				return;
			}
			if(parseInt(this.player.currentTime) % 10 == 0) {
				this.recordCurrent(true);
			}
			const pct = this.setProgressPercentage();
			this.detectProgressMove();
		};
	}

	static iconToggle(isPlaying) {
		const $buttons = $("div.btn-group i");
		let $btn = isPlaying ? $buttons.find("svg.fa-play") : $buttons.find("svg.fa-pause");
		//console.log(isPlaying, $btn);
		if ($btn.length) {
			$btn.removeClass(isPlaying ? "fa-play" : "fa-pause");
			$btn.addClass(isPlaying ? "fa-pause" :"fa-play");
		}
	}

	static download(cast, ep) {
		const rec = {
			lnk: ep.mediaURL,
			artist: cast.author,
			ttl: cast.name,
			title: ep.title,
			img: cast.imageURL
		}
		$.download('/php/util/encodeID3Download.php', rec, 'dlFrame');
		JSAlert.alert(`${rec.ttl} - ${rec.title} to be downloaded soon. Wait a while to be processed`).dismissIn(1000 * 2);
	}

	recordCurrent(toRecord) {
		let qpb = QuickPlayer.getBookmarks();
		if(!qpb) {
			qpb = {};
		}
		const mediaSrc = $('#player').attr('src');
		if(toRecord) {
			const rec = {
				title: $('#ep-title').attr('title'),
				image: $('#ep-image').attr('src'),
				cast: $('#ep-image').attr('title'),
				mediaURL: mediaSrc,
				currentTime: document.querySelector('#player').currentTime,
				recordedAt: new Date().getTime()
			};
			qpb[rec.mediaURL] = rec;
		} else {
			if (qpb.hasOwnProperty(mediaSrc)) {
				delete qpb[mediaSrc];
			}
		}
		localStorage.setItem(QPHelper.storeKey, JSON.stringify(qpb));
	}

	detectProgressMove() {
		const pbar = document.querySelector("#playerProgress");
		$('div.progress').on('click', e => {
			const ctime = this.player.duration * (e.offsetX / e.currentTarget.offsetWidth);
			this.player.currentTime = ctime;
		});
	}

	setProgressPercentage() {
		const $pbar = $("div.progress-bar");
		const pct = parseInt((this.player.currentTime / this.player.duration) * 100);
		$pbar.attr("style", `width: ${pct}%`);
		$pbar.attr("arial-valuenow", pct);
		$("#progressStat").text(`${QPHelper.makeTimeInfo(this.player.currentTime)} / ${QPHelper.makeTimeInfo(this.player.duration)} (${pct}%)`);
		return pct;
	}

	async renderCast(cast, $md) {
		const modal_html = await QPHelper.loadHTML('components/modal_episodes.html');
		$md.html(modal_html);
		const header = `<div class="media text-right">
                            <!--// <div class="media-left"><img src="${cast.imageURL}" class="media-object rounded" width="60px"></div> //-->
							<div class="media-body"><h5 class="media-heading mt-0 font-weight-bold">${cast.name} <span class="badge badge-info">${cast.episodes}</span></h5>
							<small class='font-weight-bold'>last update: ${cast.lastPubAt.slice(0,-3)}</small>
							</div>
                            </div>`
		$md.find('h5.modal-title').html(header);
		fetch(this.uri_episodes + '/cast_episode/' + cast.podcastID)
		.then(res => {
			if(res.ok) 
				return res.json();
		})
		.then(eps => {
			let dtOptions = QPHelper.getDTOptionsTemplate();
			dtOptions.data = eps;
			dtOptions.sDom = '<"search-box"r>lftip';
			dtOptions.oLanguage = { sProcessing: "<div id='loader'></div>" };
			dtOptions.columns = QPHelper.columnsEpisode;
			dtOptions.order = [1, 'desc'];
			this.episodeTab = $('#tabEpisodes').DataTable(dtOptions);
			const $dtab = this.episodeTab;
			this.episodeTab.on('click', 'tbody tr td span', (e) => {
				const pdat = $dtab.row(e.currentTarget.closest('tr')).data();
				this.playEpisode(cast, pdat);
				console.log(pdat);
			});
			this.episodeTab.on('click', 'tbody tr td button', (e) => {
				const pdat = $dtab.row(e.currentTarget.closest('tr')).data();
				QuickPlayer.download(cast, pdat);
			});
			this.episodeTab.columns.adjust().responsive.recalc();
			$('#spinner_modal').hide();
		});
		if(this.episodeTab) {
			this.episodeTab.clear().draw();
		}
		$md.find('div.modal-content').css('background-image', 'linear-gradient(rgba(255,255,255,0.4), rgba(255,255,255,0.4)), url(' + cast.imageURL + ')');
		$md.find('div.modal-content').css('background-size', 'cover');
		$md.modal('show');
	}

	async renderBookmarks($md) {
		let bookmarks = QuickPlayer.getBookmarks();
		if(bookmarks == null) {
			return;
		}
		let eps = [];
		for(let k in bookmarks) {
			eps.push(bookmarks[k]);
		}
		eps.sort((a,b) => b.recordedAt - a.recordedAt);
		const modal_html = await QPHelper.loadHTML('components/modal_bookmarks.html');
		$md.html(modal_html);
		//console.log(eps);
		let dtOptions = QPHelper.getDTOptionsTemplate();
		dtOptions.data = eps;
		dtOptions.sDom = '<"search-box"r>lftip';
		dtOptions.columns = QPHelper.columnsBookmark;
		dtOptions.order = [3, 'desc'];
		let $dtab = $('#tabEpisodes').DataTable(dtOptions);
		$dtab.columns.adjust().responsive.recalc();
		$dtab.on('click', 'tbody tr span[title=resume],tbody h5', (e) => {
			const pdat = $dtab.row(e.currentTarget.closest('tr')).data();
			const cast = this.casts.find(c => c.name == pdat.cast);
			this.playEpisode(cast, pdat);
			console.log(pdat);
		});
		$dtab.on('click', 'tbody tr i[title=delete]', (e) => {
			const row = e.currentTarget.closest('tr');
			QPHelper.deleteBookmark(QPHelper.storeKey, $dtab.row(row).data().mediaURL);
			$dtab.row(row).remove().draw();
		});
		$('#spinner_modal').hide();
		$md.modal('show');
	}

	static getBookmarks() {
		if(localStorage.getItem(this.storeKey)) {
			return JSON.parse(localStorage.getItem(QPHelper.storeKey));
		}
		return null;
	}

	playEpisode(cast, ep) {
		if (this.player != null && !this.player.paused) {
			this.player.pause();
		}
		$("#playerToggler").removeClass('d-none');
		this.player.src = ep.mediaURL;
		$('#ep-title').text(QPHelper.stringCut(ep.title, 30));
		$('#ep-title').attr('title', ep.title);
		$('#ep-image').attr('src', cast.imageURL).on('click', (e) => {
			this.renderCast(cast, $("#popCast"));
		});;
		$('#ep-image').attr('title', cast.name);
		this.player.setAttribute('src', ep.mediaURL);
		this.seekResume();
		if (!$('#playerToggle').hasClass('show')) {
			$('#playerToggle').addClass('show');
		}
		$(this.player).data('cast', cast);
		$(this.player).data('episode', ep);
	}

	seekResume() {
		const p = document.querySelector('#player');
		const bm = QuickPlayer.getBookmarks();
		if(bm == null || !bm.hasOwnProperty(p.src)) {
			return;
		}
		const r = bm[p.src];
		console.log('src', p.src, 'record', r);
		if(bm != null &&  r != null) {
			p.currentTime = r.currentTime;
		}
	}
}

$(document).ready(function() {
	const qp = new QuickPlayer();
	qp.init();
	console.log(qp);
});