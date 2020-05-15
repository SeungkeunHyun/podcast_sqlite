class QPHelper {
	static storeKey = 'qpBookmarks';
	static htmlCache = {};
	static col_classes = ['primary', 'success', 'info', 'warning', 'secondary', 'danger'];
	static getDTOptionsTemplate() {
		return JSON.parse('{"authWidth": true, "responsive": true, "processing": true, "destroy": true, "deferRender": true, "fixedHeader": true, "select": true}');
	}
	static columnsEpisode = [
		{
			"data": "title",
			"title": "title",
			"render": function (val, typ, row, meta) {
				return `<i class='fas fa-lg fa-${row.mediaURL.match(/\.mp3/i) != null ? 'headphones' : 'tv'}'></i><span style='cursor:pointer' class='bg_opaque_white' title='${val}' >${val} <i class='fas fa-play'></i></span>
				${row.duration != null ? '<div class="font-weight-bold bg_opaque_white"><i class="fas fa-hourglass-start"></i>' + (isNaN(row.duration.trim()) ? row.duration.replace(/^0+:/,'') : QPHelper.makeTimeInfo(row.duration.trim())) + '</div>' : ''}
				`;
			}
		},
		{
			"data": "pubDate",
			"title": "published",
			"render": function (val, typ, row, meta) {
				const dat = moment.utc(val).add(9, 'hours');
				return `<span style='display:none'>${dat.valueOf()}</span><span class='bg_opaque_white' title='${val}'>${moment(val).fromNow()}</span>`;
			}
		},
		{
			"data": "mediaURL",
			"title": "<i class='fas fa-download'></i>",
			"render": function (val, typ, row, meta) {
				return `<button class='btn' type='button' role='button' title='${val}'><i class='fas fa-download'></i></button>`;
			}
		}
	];

	static getInitialOfTitle(title) {
		let i = null;
		for (i of Hangul.disassemble(title)) {
			if (!i.match(/\s|\[|'|"/)) {
				break;
			}
		}
		return i.toUpperCase();
	}

	static generateCastInitials(casts) {
		let initials = {};
		for(let c of casts) {
			let i = this.getInitialOfTitle(c.name);
			if(!initials.hasOwnProperty(i)) {
				initials[i] = [];
			}
			initials[i].push(c);
		}
		console.log(initials);
		return initials;
	}

	static columnsBookmark = [
		{
			data: "cast",
			title: "cast",
			render: (v, t, r, m) => {
				return `<img src='${r.image}' width='40' alt='${r.cast}' class='rounded'>`;
			}
		},
		{
			data: "title",
			title: "title",
			render: (v, t, r, m) => {
				return `<h5 class='font-weight-bold'>${r.cast}</h5><p><i class='fas fa-lg fa-${r.mediaURL.match(/\.mp3/i) != null ? 'headphones' : 'tv'}'></i> ${v} <i style="cursor:pointer" title="delete" class="far fa-trash-alt fa-lg"></i></p>`;
			}
		},
		{
			data: "currentTime",
			title: "current time",
			render: (v, t, r, m) => {
				if(v)
					return '<span title="resume" style="cursor:pointer"><i class="fas fa-stopwatch"></i> ' + QPHelper.makeTimeInfo(v) + '</span>';
				else
					return '';
			}
		},
		{
			data: "recordedAt",
			title: "recorded at",
			render: (v, t, r, m) => {
				return moment(v).format('YYYY-MM-DD H:mm');
			}
		}
	];

	static columnsSearch = [
		{
			data: "cast",
			title: "cast",
			render: (v, t, r, m) => {
				return `<img src='${r.image}' width='40' alt='${r.cast}' class='rounded'>`;
			}
		},
		{
			data: "title",
			title: "title",
			render: (v, t, r, m) => {
				return `<h5 class='font-weight-bold'>${r.cast}</h5><p><i class='fas fa-lg fa-${r.mediaURL.match(/\.mp3/i) != null ? 'headphones' : 'tv'}'></i> ${v}</p>`;
			}
		},
		{
			data: "pubDate",
			title: "published",
			render: (v, t, r, m) => {
				const dat = moment.utc(v).local();
				return `<span style='display:none'>${dat.valueOf()}</span><span>${dat.fromNow().replace(/\s+ago$/, '')}</span>`;
			}
		}
	];

	static columnsCast = [
		{
			"data": "provider",
			"title": "provider",
			"visible": false
		},
		{
			"data": "category",
			"title": "category",
			"visible": false
		},
		{
			"data": "name",
			"title": "title",
			"width": "50%",
			"render": function (val, typ, row, meta) {
				return `<div class='image-box media' style='--image-url:url(${row.imageURL})'>
							<div class='media-body p-1'><h5 class='media-heading'>${val} <span class='badge badge-info'>${row.episodes}</span></h5>
								<div class='media-content'>
									${(row.author && row.author !== val) ? '<small>by <span class="font-weight-bold">' + row.author + '</span></small><br/>' : ''}
									<small title='${row.summary}'>${row.summary == null ? '' : QPHelper.stringCut(row.summary, 80)}<br/><span class='text-right'>last update: ${row.lastPubAt == null ? '' : moment(row.lastPubAt).add(9, 'hours').format('YY/MM/DD HH:mm')}</small>
								</div>
								<div class='media-footer text-right'>
									<a data-colno='1' class='font-weight-bold badge font-light bg-${QPHelper.col_classes[1]}'>${row.category}</a>
									<a data-colno='0' class='font-weight-bold badge font-light bg-${QPHelper.col_classes[0]}'>${row.provider}</a>
								</div>
							</div>
                        </div>`;
			}
		},
		{
			"data": "lastPubAt",
			"title": '<i class="fas fa-rss"></i> Since',
			"width": "10%",
			"render": function (val, typ, row, meta) {
				const dat = moment.utc(val).local();
				return `<span style='display:none'>${dat.valueOf()}</span><span class='lead text-light'>${dat.fromNow().replace(/\s+ago$/, '')} <i class='fas fa-sync-alt'></i></span>`;
			}
		},
		{
			"data": "episodes",
			"title": "episodes",
			"visible": false
		},
		{
			"data": "name",
			"title": "initial",
			"visible": false,
			"render": function (val, typ, row, meta) {
				return QPHelper.getInitialOfTitle(val);
			}
		}
	];

	static async loadHTML(uriPage) {
		if (QPHelper.htmlCache.hasOwnProperty(uriPage)) {
			return this.htmlCache[uriPage];
		}
		const res = await fetch(uriPage);
		const chtml = await res.text();
		this.htmlCache[uriPage] = chtml;
		return chtml;
	}

	static listBookmarks(bmSelector, storeKey) {
		$(bmSelector).attr('data-content', '');
		if (localStorage.getItem(storeKey) != null) {
			const bms = JSON.parse(localStorage.getItem(storeKey));
			let $ul = $('ul');
			for (let k in bms) {
				let bmark = bms[k];
				$ul.append(`<li>
							<div class='media'>
								<img class="mr-3" src="${bmark.image}" width='60' alt="${bmark.cast}">
									<div class="media-body">
										<h5 class="mt-0">${bmark.cast}</h5>
										${bmark.title} (${QPHelper.makeTimeInfo(parseInt(bmark.currentTime))})
									</div>
							</div>
						</li>`);
			}
			return "<div id='divBM'>" + $ul[0].outerHTML + "</div>";
		} else {
			return "None of bookmarks";
		}
	}

	static deleteBookmark(storeKey, recordKey) {
		const strBM = localStorage.getItem(storeKey);
		if(strBM == null) {
			return;
		}
		const jsonBM = JSON.parse(strBM);
		delete jsonBM[recordKey];
		//console.log(jsonBM);
		localStorage.setItem(storeKey, JSON.stringify(jsonBM));
	}

	static makeTimeInfo(ti) {
		if(isNaN(ti)) {
			return ti;
		}
		const dur = moment.duration(ti * 1000);
		return (dur.hours() == 0 ? '' : dur.hours() + ':') + (dur.minutes() == 0 ? '' : dur.minutes() + ':') + dur.seconds();
	}

	static stringCut(txt, len) {
		if(!txt) {
			return '';
		}
		return txt.length > len ? txt.substring(0, len) + '..' : txt;
	}
}