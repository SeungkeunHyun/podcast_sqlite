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
		await this.fetchEpisodes();
		this.casts.filter(cast => this.updatedCasts.indexOf(cast.podcastID) > -1).forEach(async(cast) => {
			const res = await fetch(this.uri_vcast + '/podcastID/' + cast.podcastID);
			cast = await res.json();
		});
		this.mainTab = $("#tabCasts").DataTable({
			data: this.casts,
			authWidth: true,
			responsive: true,
			paging: false,
			destroy: true,
			deferRender: true,
			fixedHeader: true,
			sDom: '<"search-box"r>lftip',
			columnDefs: [
				{ responsivePriority: 1, targets: 2 },
				{ responsivePriority: 2, targets: 1 }
			],
			columns: QPHelper.columnsCast,
			order: [3, 'desc']
		});
		this.mainTab.columns.adjust().responsive.recalc();
		this.addEvents();
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

	fetchEpisodes() {
		this.casts.forEach( async(c) => {
			const fetchURL = this.getFetchURL(c);
			//console.log(c, c.feedURL);
			const data = await $.ajax({
				url: this.herokuFetcher, 
				data: {uri: fetchURL },
				dataType: c.provider == 'itunes' ? 'xml' : 'html'
			});
			let episodes = await this.parseEpisodes(c, data);
			let done = false;
			for(let itm of episodes) {
				itm.cast_episode = c.podcastID;
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
					if(res.hasOwnProperty('error') || res.responseText.indexOf('Warning') > -1) {
						//console.error('error in posting', res, itm);
						if(episodes.length > 15) {
							break;
						}
					} else if (this.updatedCasts.indexOf(c.podcastID) == -1) {
						this.updatedCasts.push(c.podcastID);
						console.log('posting result', res, itm);
					}
				} catch(res) {
					console.error(itm, res.responseText);
					break;
				}
				//console.log(c.provider, episodes);
			}
		});
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
					ep.pubDate = o.querySelector('div.episodeInfo time.date') == null ? null : o.querySelector('div.episodeInfo time.date').textContent.replace('.', '-');
					ep.duration = o.querySelector('div.episodeInfo time.playTime') == null ? null : o.querySelector('div.episodeInfo time.playTime').textContent;
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
					console.log(reqURL, recCast, resp)
				});
				break;
			}
		}
		return episodes.sort((a,b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
	}

	addEvents() {
		this.mainTab.on('click', 'tbody tr', (e) => {
			console.log(e);
			const row = e.currentTarget;
			$('#spinner_modal').hide();
			this.renderCast(this.mainTab.row(row).data(), $("#popCast"));
		});
		this.player = document.getElementById('player');
		$('div.btn-group i').on('click', e => {
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
		};
		this.player.onabort= e => {
			QuickPlayer.iconToggle(false);
		};
		this.player.onpause = e => {
			QuickPlayer.iconToggle(false);
			this.recordCurrent(true);
		};
		this.player.onended = e => {
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
			this.setProgressPercentage();
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
	}

	async renderCast(cast, $md) {
		const modal_html = await QPHelper.loadHTML('components/modal_episodes.html');
		$md.html(modal_html);
		const header = `<div class="media">
                            <div class="media-left"><img src="${cast.imageURL}" class="media-object rounded" width="60px"></div>
							<div class="media-body p-3"><h5 class="media-heading mt-0">${cast.name} <span class="badge badge-info">${cast.episodes}</span></h5>
							<small>last update: ${cast.lastPubAt.slice(0,-3)}</small>
							</div>
                            </div>`
		$md.find('h5.modal-title').html(header);
		fetch(this.uri_episodes + '/cast_episode/' + cast.podcastID)
		.then(res => {
			if(res.ok) 
				return res.json();
		})
		.then(eps => {
			this.episodeTab = $('#tabEpisodes').DataTable({
				data: eps,
				destroy: true,
				processing: true,
				oLanguage: {sProcessing: "<div id='loader'></div>"},
				autoWidth: true,
				responsive: true,
				columns: QPHelper.columnsEpisode,
				order: [1, 'desc']
			});
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
		let $dtab = $('#tabEpisodes').DataTable({
			data: eps,
			destroy: true,
			responsive: true,
			processing: true,
			autoWidth: true,
			columns: QPHelper.columnsBookmark,
			order: [3, 'desc']
		});
		$dtab.columns.adjust().responsive.recalc();
		$dtab.on('click', 'tbody tr', (e) => {
			const pdat = $dtab.row(e.currentTarget).data();
			const cast = this.casts.find(c => c.name == pdat.cast);
			this.playEpisode(cast, pdat);
			console.log(pdat);
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
		if($("#playerToggler").hasClass('disabled')) {
			$("#playerToggler").removeClass('disabled');
		}
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