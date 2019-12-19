class QuickPlayer {
	uri_vcast = '/php/rest-sqlite/index.php/v_casts';
	uri_episodes = '/php/rest-sqlite/index.php/episodes';
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
			sDom: '<"search-box"r>lftip',
			columnDefs: [
				{ responsivePriority: 1, targets: 2 },
				{ responsivePriority: 2, targets: 1 }
			],
			columns: [
				{
					"data": "provider",
					"title": "provider",
					"width": "5%"
				},
				{
					"data": "category",
					"title": "category",
					"width": "8%"
				},
				{
					"data": "name",
					"title": "title",
					"width": "50%",
					"render": function (val, typ, row, meta) {
						return `<div class='media'>
                            <div class='media-left'><img src='${row.imageURL}' class='media-object rounded' width='60px'></div>
							<div class='media-body p-3'><h5 class='media-heading'>${val} <span class='badge badge-info'>${row.episodes}</span></h5>
							last published at: ${row.lastPubAt}
							</div>
                            </div>`;
					}
				},
				{
					"data": "lastPubAt",
					"title": "last pub at",
					"width": "10%",
					"render": function(val, typ, row, meta) {
						const dat = moment(val);
						return `<span style='display:none'>${dat.valueOf()}</span>${moment(val).fromNow()}`;
					}
				},
				{
					"data": "episodes",
					"title": "episodes",
					"visible": false
				}
			],
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
			console.log(c, c.feedURL);
			const data = await $.ajax({
				url: this.herokuFetcher, 
				data: {uri: fetchURL },
				dataType: c.provider == 'itunes' ? 'xml' : 'html'
			});
			let episodes = this.parseEpisodes(c.provider, data);
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
						console.error('error in posting', res, itm);
						break;
					}
					if (this.updatedCasts.indexOf(c.podcastID) == -1) {
						this.updatedCasts.push(c.podcastID);
					}
					console.log('posting result', res.responseText, itm);
				} catch(res) {
					console.error(itm, res.responseText);
					break;
				}
				console.log(c.provider, episodes);
			}
		});
	}

	parseEpisodes(provider, src) {
		let $el = null;
		const episodes = [];
		let ep = null;
		switch(provider) {
			case 'podbbang':
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
		return episodes.sort((a,b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
	}

	addEvents() {
		this.mainTab.on('click', 'tbody tr', (e) => {
			console.log(e);
			const row = e.currentTarget;
			this.renderCast(this.mainTab.row(row).data(), $("#popCast"));
		});
		this.player = document.getElementById('player');
		$('#playerButtons i').on('click', e => {
			const btn = e.currentTarget.querySelector('svg');
			console.log(btn);
			if (btn.classList.contains('fa-play')) {
				btn.classList.remove('fa-play');
				btn.classList.add('fa-pause');
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
				btn.classList.remove('fa-pause');
				btn.classList.add('fa-play');
				this.player.pause();
				return;
			}
		});
		/*
		this.player.addEventListener('play', e => {
			console.log(e);
		});
		this.player.addEventListener('pause', e => {
		});
		this.player.addEventListener('abort', e => {
		});
		*/
		this.player.addEventListener('timeupdate', e=> {
			if(isNaN(this.player.duration)) {
				return;
			}
			this.setProgressPercentage();
		});
	}

	makeTimeInfo(ti) {
		const dur = moment.duration(ti * 1000);
		return (dur.hours() == 0 ? '' : dur.hours() + ':') + (dur.minutes() == 0 ? '' : dur.minutes()  + ':') + dur.seconds();
	}

	setProgressPercentage() {
		const $pbar = $("div.progress-bar");
		const pct = parseInt((this.player.currentTime / this.player.duration) * 100);
		$pbar.attr("style", `width: ${pct}%`);
		$pbar.attr("arial-valuenow", pct);
		$("#progressStat").text(`${this.makeTimeInfo(this.player.currentTime)} / ${this.makeTimeInfo(this.player.duration)} (${pct}%)`);
	}	

	renderCast(cast, $md) {
		const header = `<div class="media">
                            <div class="media-left"><img src="${cast.imageURL}" class="media-object rounded" width="60px"></div>
							<div class="media-body p-3"><h5 class="media-heading">${cast.name} <span class="badge badge-info">${cast.episodes}</span></h5>
							last published at: ${cast.lastPubAt}
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
				autoWidth: true,
				responsive: true,
				columns: [
					{
						"data": "title",
						"title": "title"
					},
					{
						"data": "pubDate",
						"title": "published"
					}
				],
				order: [1, 'desc']
			});
			this.episodeTab.on('click', 'tbody tr', (e) => {
				const pdat = this.episodeTab.row(e.currentTarget).data();
				this.playEpisode(cast, pdat);
				console.log(pdat);
			});
			this.episodeTab.columns.adjust().responsive.recalc();
			$('#spinner_modal').hide();
		});
		$md.modal('show');
	}

	stringCut(txt, len) {
		return txt.length > len ? txt.substring(0, len) + '..' : txt;
	}

	playEpisode(cast, ep) {
		document.querySelector("#player").src = ep.mediaURL;
		$('#ep-title').text(this.stringCut(ep.title, 30));
		$('#ep-title').attr('title', ep.title);
		$('#ep-image').attr('src', cast.imageURL);
		$('#ep-image').attr('title', cast.name);
		$('#player').attr('src', ep.mediaURL);
		if (!$('#navbarSupportedContent').hasClass('show')) {
			$('#navbarSupportedContent').addClass('show');
		}
	}
}

$(document).ready(function() {
	const qp = new QuickPlayer();
	qp.init();
});