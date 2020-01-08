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
	queryParams = null;
	$modalWindow = null;
	isMobile = window.orientation > -1;
	constructor() {
		this.queryParams = $.getQueryParams(document.location.href);
		this.$modalWindow = $("#popCast");
		if(!document.location.href.includes('skhyun.pe.hu')) {
			let $hostedSite = $(`<iframe id="hostFrame" name="hostFrame" src="http://skhyun.pe.hu/quickplay" style="display:none;width:0px; height:0px; border: 0px"></iframe>`);
			$('body').append($hostedSite);
			$hostedSite.on('load', e => console.log('loading hosted site', e));
		}
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
			this.dicCasts = QPHelper.generateCastInitials(this.casts);
			await this.initializeUI();
			$('#spinner').hide();
		}).catch(ex => {
			console.error(ex);
		});
		$("#po-bookmarks").on('click', (e) => {
			this.renderBookmarks($('#popCast'));
		});
		this.$modalWindow.on('hidden.bs.modal', function () {
			$(this).data('bs.modal', null);
		});
	}

	processQueryParams() {
		for(let k in this.queryParams) {
			switch(k) {
				case 'podcastID':
					const cast = this.casts.find(c => c.podcastID == this.queryParams[k]);
					this.renderCast(cast, this.$modalWindow);
					return;
				case 'category':
					const $categoryFilter = $("a[data-colno=1]:contains(" + this.queryParams.category + ")");
					if ($categoryFilter.length) {
						$categoryFilter[0].click();
					}
					break;
				case 'provider':
					const $providerFilter = $("a[data-colno=0]:contains(" + this.queryParams.provider + ")");
					if ($providerFilter.length) {
						$providerFilter[0].click();
					}
					break;
			}
		}
	}

	async initializeUI() {
		let dtOptions = QPHelper.getDTOptionsTemplate();
		const spOptions = {
			"data": this.casts,
			"paging": false,
			"scrollY": window.innerHeight - 100,
	        "scrollCollapse": true,
			"sDom": '<"search-box"r>lftip',
			"columnDefs": [{ responsivePriority: 1, targets: 2 }, { responsivePriority: 2, targets: 3 }],
			"columns": QPHelper.columnsCast,
			"order": [3, 'desc']
		};
		this.mainTab = $("#tabCasts").DataTable({...dtOptions, ...spOptions});
		this.mainTab.columns.adjust().responsive.recalc();
		this.addEvents();
		this.processQueryParams();
		this.addFilters();
		if(this.isMobile) {
			return;
		}
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
		$(window).bind('resize', (e) => {
			var NewHeight = $(document).height() - 260;
			var oSettings = this.mainTab.fnSettings();
			oSettings.oScroll.sY = NewHeight + "px";
			console.log(oSettings.oScroll.sY);
			this.mainTab.fnDraw();
		});
	}

	addFilters() {
		let $ol = $('#ul_filters');
		const filters = ["0-9,A-Z", "ㄱ-ㅎ", "category", "provider"];
		const sortedKeys = Object.keys(this.dicCasts).sort();
		for(let f of filters) {
			const $li = $(`<li class='page-item btn btn-outline-warning flex-fill' style='cursor:pointer'><i class='fas fa-filter'></i> ${f}</li>`);
			//$li.data('cast', this.dicCasts[k]);
			switch(f) {
				case '0-9,A-Z':
					$li.data('indices', sortedKeys.filter(i => i.match(/[0-9|A-Z]/) != null));
					break;
				case 'ㄱ-ㅎ':
					$li.data('indices', sortedKeys.filter(i => i.match(/[^(0-9|A-Z)]/) != null));
					break;
				case 'category':
					$li.data('indices', [...new Set(this.casts.map(item => item.category))]);
					break;
				case 'provider':
					$li.data('indices', [...new Set(this.casts.map(item => item.provider))]);
					break;
			}
			$ol.append($li);
			const $filterValues = $("#ul_filterValues");
			$li.on('click', (e) => {
				$li.siblings().removeClass('active');
				$li.toggleClass('active');
				$filterValues.empty();
				if(!$li.hasClass('active')) {
					return;
				}
				$filterValues.data('type', $li.text().trim());
				$li.data('indices').forEach(i => $filterValues.append(`<li class='page-item flex-fill' style='cursor:pointer'>${i}</li>`));
				$filterValues.find('li').on('click', (e) => {
					const filterText = e.target.textContent;
					switch($filterValues.data('type')) {
						case 'category':
							this.filterColumn(1, filterText);
							break;
						case 'provider':
							this.filterColumn(0, filterText);
							break;
						default:
							this.filterColumn(5, filterText);
							break;
					}
				});
			});
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
				const failCount = await this.refreshEpisode(cast, 1);
				//console.log('episode loading result', cast, failCount);
		}));
	}

	async refreshEpisode(cast, page) {
		let fetchURL = this.getFetchURL(cast);
		if(page != 1) {
			fetchURL += fetchURL.indexOf('?') == -1 ? '?' : '&';
			fetchURL += 'page=' + page;
		}
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
		if(episodes.length > 0 && failCount == 0 && cast.provider !== 'itunes') {
			console.log(failCount, cast);
			this.refreshEpisode(cast, page+1);
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
					if (episode[key].down_file.match(/paidcontent/i) != null) {
						return;
					}
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

	addContextMenu() {
		const $mtab = this.mainTab;
		const currentPage = document.location.href.replace(/\?.+$/, '');
		$.contextMenu({
			selector: '#tabCasts tbody tr',
			name: 'Copy URL',
			icon: 'copy',
			callback: function (key, opt) {
				const rdat = $mtab.row(this).data();
				let queryString = '?'
				switch(key) {
					case 'copy_cast':
						queryString += 'podcastID=' + rdat.podcastID;
						break;
					case 'copy_category':
						queryString += 'category=' + rdat.category;
						break;
					case 'copy_provider':
						queryString += 'provider=' + rdat.provider;
						break;
				}
				$.copyToClipboard(currentPage + queryString);
			},
			items: {
				copy_url: {
					name: "Copy URL",
					icon: 'copy',
					items: {
						copy_cast: {
							name: "Copy cast URL"
						},
						copy_category: {
							name: "Copy category URL"
						},
						copy_provider: {
							name: "Copy provider URL"
						}
					}
				}
			}
		});
	}

	addEvents() {
		this.mainTab.on('click', 'tbody tr td h5.media-heading,tbody tr td small', (e) => {
			const row = e.currentTarget.closest('tr');
			$('#spinner_modal').hide();
			this.renderCast(this.mainTab.row(row).data(), this.$modalWindow);
		});
		this.mainTab.on('click', 'tbody tr td span.lead', async (e) => {
			const row = e.currentTarget.closest('tr');
			const $icon = $(e.currentTarget.querySelector('svg'));
			$icon.addClass('fa-spin');
			const cdat = this.mainTab.row(row).data();
			await this.refreshEpisode(cdat,1);
			const refdat = await this.fetchCast(cdat.podcastID);
			console.log('refreshed cast', refdat);
			this.mainTab.row(row).data(refdat);
			$icon.removeClass('fa-spin');
		});
		this.mainTab.on('click', 'tbody tr td div.media-footer a', async (e) => {
			const colno = parseInt(e.currentTarget.getAttribute('data-colno'));
			this.filterColumn(colno, e.currentTarget.textContent.trim());
		});
		this.addContextMenu();
		this.addSearch();
		this.player = document.getElementById('player');
		this.addPlayerControls();
	}

	filterColumn(colno, srchWord) {
		const $filterLabel = $('div.dataTables_filter label');
		if ($filterLabel.find(`a:contains('${srchWord}')`).length) {
			return;
		}
		$filterLabel.find(`a[data-colno='${colno}']`).remove();
		this.mainTab.column(colno).search('').draw();
		let $srchTag = $(`<a data-colno='${colno}' class='m-1 badge text-light font-weight-bold bg-${QPHelper.col_classes[colno]}'>${srchWord}<i class='fas fa-times m-1'></i></a>`)
		$("div.dataTables_filter label").prepend($srchTag);
		$srchTag.on('click', async (e) => {
			colno = parseInt(e.currentTarget.getAttribute('data-colno'));
			this.mainTab.column(colno).search('').draw();
			e.currentTarget.remove();
			console.log(e);
		});
		console.log($srchTag);
		this.mainTab.column(colno).search(srchWord).draw();
	}

	addSearch() {
		const $srchForm = $('#searchForm');
		$srchForm.on('click', 'button', (e) => {
			e.preventDefault();
			if($srchForm.find('input').val().trim().length === 0) {
				return;
			}
			this.renderSearchResult($srchForm.find('input').val().trim());
		});
	}

	async renderSearchResult(kwd) {
		console.log('search keyword', kwd);
		const res = await fetch(this.uri_episodes + '/title/%25' + kwd + '%25');
		const searchResults = await res.json();
		for(let e of searchResults) {
			let c = this.casts.find(i => i.podcastID === e.cast_episode);
			e.cast = c.name;
			e.image = c.imageURL;
		}
		console.log(searchResults);
		const modal_html = await QPHelper.loadHTML('components/modal_bookmarks.html');
		this.$modalWindow.html(modal_html);
		this.$modalWindow.find('h5').html(`<h5><i class='fas fa-search'></i> Search results(keyword: ${kwd}, searched: ${searchResults.length})</h5>`)
		//console.log(eps);
		let dtOptions = QPHelper.getDTOptionsTemplate();
		const spOptions = {
			"data": searchResults,
			"sDom": '<"search-box"r>lftip',
			"columns": QPHelper.columnsSearch,
			"order": [2, 'desc']
		}
		let $dtab = $('#tabEpisodes').DataTable({ ...dtOptions, ...spOptions });
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
		this.$modalWindow.modal('show');
	}

	addPlayerControls() {
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
		const $playerToggler = $("#playerToggler");
		this.player.onplay = e => {
			$playerToggler.removeClass('d-none');
			QuickPlayer.iconToggle(true);
			$playerToggler.addClass('blink_me');
		};
		this.player.onabort = e => {
			$playerToggler.removeClass('blink_me');
			QuickPlayer.iconToggle(false);
		};
		this.player.onpause = e => {
			$playerToggler.removeClass('blink_me');
			QuickPlayer.iconToggle(false);
			this.recordCurrent(true);
		};
		this.player.onended = e => {
			$playerToggler.removeClass('blink_me');
			QuickPlayer.iconToggle(false);
			this.recordCurrent(false);
		}

		this.player.ontimeupdate = e => {
			if (isNaN(this.player.duration)) {
				return;
			}
			if (parseInt(this.player.currentTime) % 10 == 0) {
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
							<small class='font-weight-bold'>last update: ${moment(cast.lastPubAt).add(9, 'hours').format('YY/MM/DD HH:mm')}</small>
							</div>
                            </div>`
		$md.find('h5.modal-title').html(header);
		$md.find('div.modal-content').css('background-image', 'linear-gradient(rgba(255,255,255,0.4), rgba(255,255,255,0.4)), url(' + cast.imageURL + ')');
		$md.find('div.modal-content').css('background-size', 'cover');
		$md.modal('show');
		if (this.episodeTab !== null) {
			this.episodeTab.destroy();
		}
		fetch(this.uri_episodes + '/cast_episode/' + cast.podcastID)
		.then(res => {
			if(res.ok) 
				return res.json();
		})
		.then(eps => {
			let dtOptions = QPHelper.getDTOptionsTemplate();
			const spOptions = {
				"data": eps,
				"sDom": '<"search-box"r>lftip',
				"oLanguage": { sProcessing: "<div id='loader'></div>" },
				"columns": QPHelper.columnsEpisode,
				"order": [1, 'desc']
			}
			this.episodeTab = $('#tabEpisodes').DataTable({...dtOptions, ...spOptions});
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
			this.selectPlayingRow($dtab, cast);
		});
	}

	selectPlayingRow($dtab, cast) {
		if(!this.player.attributes.hasOwnProperty('src')) {
			return;
		}
		const $p = $(this.player);
		if($p.data('cast').podcastID !== cast.podcastID) {
			return;
		}
		console.log(cast, this.player.src);
		let pg = 0;
		this.episodeTab.rows().every(function(ridx, tl, rl) {
			if(this.data().mediaURL === $p.data('episode').mediaURL) {
				//console.log($dtab.page, this, ridx, tl, rl);
				this.select();
				pg = Math.floor(rl / $dtab.page.len());
				return;
			}
		});
		console.log('current page', pg);
		$dtab.page(pg).draw(false);
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
		const spOptions = {
			"data": eps,
			"sDom": '<"search-box"r>lftip',
			"columns": QPHelper.columnsBookmark,
			"order": [3, 'desc']
		}
		let $dtab = $('#tabEpisodes').DataTable({...dtOptions, ...spOptions});
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
		if (ep.mediaURL.match(/\.mp3/i) == null) {
			if($("#player").hasClass('d-none')) {
				$("#player").removeClass('d-none');
			}
		} else {
			if (!$("#player").hasClass('d-none')) {
				$("#player").addClass('d-none');
			}
		}
		this.player.src = ep.mediaURL;
		$('#ep-title').text(QPHelper.stringCut(ep.title, 30));
		$('#ep-title').attr('title', ep.title);
		$('#ep-image').attr('src', cast.imageURL).on('click', (e) => {
			this.renderCast(cast, this.$modalWindow);
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
		//console.log('src', p.src, 'record', r);
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